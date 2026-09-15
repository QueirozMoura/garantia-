// Testes do fluxo de "Adicionar compra" no modo de acesso progressivo.
//
// Guest: o formulário funciona, mas ao salvar gera um RASCUNHO local e vai
// para /login — NENHUMA chamada de API (createPurchase/upload/extract).
// Authenticated: comportamento original preservado + retomada do rascunho.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import {
  ApiError,
  createPurchase,
  uploadPurchaseDocument,
  extractDocument,
} from '../lib/api.ts'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import {
  GUEST_PURCHASE_DRAFT_KEY,
  getGuestPurchaseDraft,
  saveGuestPurchaseDraft,
} from '../services/guest-drafts.ts'
import type { PurchaseFormFields } from '../components/purchases/purchase-form.ts'
import { AddPurchase } from './AddPurchase.tsx'

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return {
    ...actual,
    createPurchase: vi.fn(),
    uploadPurchaseDocument: vi.fn(),
    extractDocument: vi.fn(),
    confirmDocumentExtraction: vi.fn(),
  }
})

const mockCreatePurchase = vi.mocked(createPurchase)
const mockUpload = vi.mocked(uploadPurchaseDocument)
const mockExtract = vi.mocked(extractDocument)

const FIELDS: PurchaseFormFields = {
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  serialNumber: 'SN-12345',
  store: 'Magazine Luiza',
  purchaseDate: '2026-01-15',
  price: '8749.90',
  category: 'Informática',
}

const createdPurchase = {
  id: 'purchase-1',
  productName: FIELDS.productName,
  brand: FIELDS.brand,
  model: FIELDS.model,
  serialNumber: FIELDS.serialNumber,
  store: FIELDS.store,
  purchaseDate: FIELDS.purchaseDate,
  price: '8749.90',
  category: FIELDS.category,
  warranty: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
}

function renderAddPurchase(
  status: 'guest' | 'authenticated' | 'loading',
  auth: Partial<AuthContextValue> = {},
) {
  const user = userEvent.setup()
  const utils = render(
    <AuthContext.Provider value={makeAuthValue(status, auth)}>
      <MemoryRouter initialEntries={['/purchases/new']}>
        <Routes>
          <Route path="/purchases/new" element={<AddPurchase />} />
          <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          <Route path="/purchases" element={<div>PURCHASES_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { user, ...utils }
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Nome do produto/), FIELDS.productName)
  await user.type(screen.getByLabelText('Marca'), FIELDS.brand)
  await user.type(screen.getByLabelText('Modelo'), FIELDS.model)
  await user.type(screen.getByLabelText('Número de série'), FIELDS.serialNumber)
  await user.type(screen.getByLabelText('Loja'), FIELDS.store)
  await user.type(screen.getByLabelText(/Data da compra/), FIELDS.purchaseDate)
  await user.type(screen.getByLabelText(/Preço/), FIELDS.price)
  await user.type(screen.getByLabelText(/Categoria/), FIELDS.category)
}

describe('AddPurchase — guest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('mostra o aviso de modo visitante, sem bloquear o formulário', () => {
    renderAddPurchase('guest')

    expect(
      screen.getByText(/Sua compra será salva depois que você entrar/),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do produto/)).toBeEnabled()
  })

  it('guest NÃO chama createPurchase ao salvar; salva draft e vai para /login', async () => {
    const { user } = renderAddPurchase('guest')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
    expect(mockCreatePurchase).not.toHaveBeenCalled()

    const draft = getGuestPurchaseDraft()
    expect(draft?.data.productName).toBe(FIELDS.productName)
    expect(draft?.data.category).toBe(FIELDS.category)
  })

  it('guest não chama upload nem extração', async () => {
    const { user } = renderAddPurchase('guest')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    await screen.findByText('LOGIN_PAGE')
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('envia resumeAction de rascunho para o login', async () => {
    function LoginProbe() {
      const location = useLocation()
      const state = location.state as {
        resumeAction?: string
        from?: { pathname?: string }
      } | null
      return (
        <div>
          <span>LOGIN_PAGE</span>
          <span data-testid="resume">{state?.resumeAction ?? ''}</span>
          <span data-testid="from">{state?.from?.pathname ?? ''}</span>
        </div>
      )
    }

    const user = userEvent.setup()
    render(
      <AuthContext.Provider value={makeAuthValue('guest')}>
        <MemoryRouter initialEntries={['/purchases/new']}>
          <Routes>
            <Route path="/purchases/new" element={<AddPurchase />} />
            <Route path="/login" element={<LoginProbe />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
    expect(screen.getByTestId('resume')).toHaveTextContent('purchase-draft')
    expect(screen.getByTestId('from')).toHaveTextContent('/purchases/new')
  })

  it('guest não salva draft quando o formulário é inválido', async () => {
    const { user } = renderAddPurchase('guest')

    // Sem preencher nada: o submit do formulário só valida.
    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    expect(screen.queryByText('LOGIN_PAGE')).not.toBeInTheDocument()
    expect(localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY)).toBeNull()
  })

  it('guest: o upload de nota fiscal está bloqueado', () => {
    renderAddPurchase('guest')

    expect(screen.getByText('Entre para anexar uma nota fiscal.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar nota fiscal' })).toBeDisabled()
  })
})

describe('AddPurchase — authenticated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('continua usando createPurchase normalmente (sem rascunho)', async () => {
    mockCreatePurchase.mockResolvedValue(createdPurchase)
    const { user } = renderAddPurchase('authenticated')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    await waitFor(() => expect(mockCreatePurchase).toHaveBeenCalledTimes(1))
    expect(mockCreatePurchase).toHaveBeenCalledWith({
      productName: FIELDS.productName,
      brand: FIELDS.brand,
      model: FIELDS.model,
      serialNumber: FIELDS.serialNumber,
      store: FIELDS.store,
      purchaseDate: FIELDS.purchaseDate,
      price: 8749.9,
      category: FIELDS.category,
    })
  })

  it('não mostra o aviso de visitante', () => {
    renderAddPurchase('authenticated')

    expect(
      screen.queryByText(/Sua compra será salva depois que você entrar/),
    ).not.toBeInTheDocument()
  })
})

describe('AddPurchase — retomada do rascunho (authenticated)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('restaura os campos e mostra a confirmação "Compra restaurada"', () => {
    saveGuestPurchaseDraft(FIELDS)

    renderAddPurchase('authenticated')

    expect(screen.getByText('Compra restaurada')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do produto/)).toHaveValue(FIELDS.productName)
    expect(screen.getByLabelText(/Categoria/)).toHaveValue(FIELDS.category)
  })

  it('NÃO chama API apenas por restaurar', () => {
    saveGuestPurchaseDraft(FIELDS)

    renderAddPurchase('authenticated')

    expect(mockCreatePurchase).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('"Continuar e salvar" chama a API e limpa o rascunho no sucesso', async () => {
    saveGuestPurchaseDraft(FIELDS)
    mockCreatePurchase.mockResolvedValue(createdPurchase)
    const { user } = renderAddPurchase('authenticated')

    await user.click(screen.getByRole('button', { name: 'Continuar e salvar' }))

    await waitFor(() => expect(mockCreatePurchase).toHaveBeenCalledTimes(1))
    expect(getGuestPurchaseDraft()).toBeNull()
  })

  it('erro na API mantém o rascunho e mostra a mensagem', async () => {
    saveGuestPurchaseDraft(FIELDS)
    mockCreatePurchase.mockRejectedValue(new ApiError('boom', 500, 'INTERNAL_ERROR'))
    const { user } = renderAddPurchase('authenticated')

    await user.click(screen.getByRole('button', { name: 'Continuar e salvar' }))

    expect(
      await screen.findByText('Não foi possível cadastrar a compra. Tente novamente.'),
    ).toBeInTheDocument()
    // Rascunho preservado para nova tentativa.
    expect(getGuestPurchaseDraft()?.data).toEqual(FIELDS)
  })

  it('"Descartar" pede confirmação, limpa o rascunho e não chama API', async () => {
    saveGuestPurchaseDraft(FIELDS)
    const { user } = renderAddPurchase('authenticated')

    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }))

    await waitFor(() => expect(getGuestPurchaseDraft()).toBeNull())
    expect(mockCreatePurchase).not.toHaveBeenCalled()
    // O banner de restauração some e o formulário volta vazio.
    expect(screen.queryByText('Compra restaurada')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do produto/)).toHaveValue('')
  })

  it('cancelar o descarte mantém o rascunho', async () => {
    saveGuestPurchaseDraft(FIELDS)
    const { user } = renderAddPurchase('authenticated')

    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(getGuestPurchaseDraft()).not.toBeNull()
  })
})
