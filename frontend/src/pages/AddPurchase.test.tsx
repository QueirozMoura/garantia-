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
  AuthenticationError,
  createPurchase,
  uploadPurchaseDocument,
  extractDocument,
  confirmDocumentExtraction,
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
const mockConfirmExtraction = vi.mocked(confirmDocumentExtraction)

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

    expect(
      screen.getByText(/Entre na sua conta para anexar documentos/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar nota fiscal' })).toBeDisabled()
  })

  it('guest: o bloco de documento permanece visível com explicação', () => {
    renderAddPurchase('guest')

    expect(
      screen.getByRole('heading', { name: 'Importar nota fiscal' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/usar a extração automática/)).toBeInTheDocument()
  })

  it('guest: o input de arquivo está desabilitado e descrito pela mensagem', () => {
    renderAddPurchase('guest')

    const input = screen.getByLabelText('Selecionar nota fiscal')
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('aria-describedby', 'invoice-guest-locked')
  })

  it('guest: o CTA "Entrar" do bloco de documento vai para /login com from', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
    expect(screen.getByTestId('from')).toHaveTextContent('/purchases/new')
    // Sem rascunho: NÃO inventa resumeAction.
    expect(screen.getByTestId('resume')).toHaveTextContent('')
  })

  it('guest: "Entrar" no documento preserva resumeAction quando já há rascunho', async () => {
    saveGuestPurchaseDraft(FIELDS)

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

    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
    expect(screen.getByTestId('resume')).toHaveTextContent('purchase-draft')
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
// ---------------------------------------------------------------------------
// Sobrevivência do rascunho à expiração de sessão (Etapa 4).
//
// O rascunho pertence ao NAVEGADOR, não à sessão autenticada. Encerrar a sessão
// (401/expiração) NÃO pode apagá-lo: a limpeza só acontece após um POST bem
// sucedido (comportamento já coberto acima).
// ---------------------------------------------------------------------------
describe('AddPurchase — rascunho sobrevive à expiração de sessão', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('401 no POST preserva o rascunho, marca expireSession e volta ao login com intenção', async () => {
    const expireSession = vi.fn()
    saveGuestPurchaseDraft(FIELDS)
    mockCreatePurchase.mockRejectedValue(new AuthenticationError())

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
      <AuthContext.Provider value={makeAuthValue('authenticated', { expireSession })}>
        <MemoryRouter initialEntries={['/purchases/new']}>
          <Routes>
            <Route path="/purchases/new" element={<AddPurchase />} />
            <Route path="/login" element={<LoginProbe />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await user.click(screen.getByRole('button', { name: 'Continuar e salvar' }))

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
    // Sessão consolidada como visitante...
    expect(expireSession).toHaveBeenCalledOnce()
    // ...e o rascunho continua no navegador, com a intenção de retomada.
    expect(getGuestPurchaseDraft()?.data).toEqual(FIELDS)
    expect(screen.getByTestId('resume')).toHaveTextContent('purchase-draft')
    expect(screen.getByTestId('from')).toHaveTextContent('/purchases/new')
  })

  it('renderizar em guest (após logout) NÃO apaga o rascunho', async () => {
    saveGuestPurchaseDraft(FIELDS)

    renderAddPurchase('guest')

    // O formulário guest aparece, mas o rascunho do navegador segue intacto.
    expect(getGuestPurchaseDraft()?.data).toEqual(FIELDS)
  })
})
// ---------------------------------------------------------------------------
// Etapa 5 — Documentos no fluxo guest/authenticated.
//
// Prova que o visitante NUNCA toca endpoints de documento (upload/extract/
// confirmation), que nenhum File/base64 vai ao localStorage e que o fluxo
// autenticado de upload → extração → confirmação continua íntegro.
// ---------------------------------------------------------------------------

/** Seleciona um arquivo de nota fiscal no input do bloco de documento. */
async function selectInvoiceFile(
  user: ReturnType<typeof userEvent.setup>,
  name = 'nota.pdf',
) {
  const input = screen.getByLabelText('Selecionar nota fiscal')
  const file = new File(['%PDF-1.4 nota'], name, { type: 'application/pdf' })
  await user.upload(input, file)
}

/** Inspeciona TODO o localStorage e devolve chaves cujo valor parece binário. */
function localStorageHasFileLikeValue(): string[] {
  const suspicious: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key) continue
    const value = localStorage.getItem(key) ?? ''
    if (/data:[^;]+;base64,|blob:|base64|%PDF-|iVBORw0KGgo|\xFF\xD8\xFF/.test(value)) {
      suspicious.push(key)
    }
  }
  return suspicious
}

describe('AddPurchase — guest: documento bloqueado (Etapa 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('guest não consegue selecionar arquivo (input desabilitado)', async () => {
    renderAddPurchase('guest')

    const input = screen.getByLabelText('Selecionar nota fiscal') as HTMLInputElement
    expect(input.disabled).toBe(true)

    // Mesmo forçando o upload programaticamente, o input desabilitado não
    // dispara o onChange — nenhum arquivo entra em memória.
    const file = new File(['%PDF-1.4'], 'nota.pdf', { type: 'application/pdf' })
    const user = userEvent.setup()
    await user.upload(input, file).catch(() => undefined)

    expect(screen.queryByText('Nota fiscal selecionada')).not.toBeInTheDocument()
  })

  it('guest não chama upload, extração nem confirmação ao salvar', async () => {
    const { user } = renderAddPurchase('guest')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    await screen.findByText('LOGIN_PAGE')
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockExtract).not.toHaveBeenCalled()
    expect(mockConfirmExtraction).not.toHaveBeenCalled()
    expect(mockCreatePurchase).not.toHaveBeenCalled()
  })

  it('o rascunho guest contém SOMENTE PurchaseFormFields (sem arquivo/base64)', async () => {
    const { user } = renderAddPurchase('guest')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))
    await screen.findByText('LOGIN_PAGE')

    const draft = getGuestPurchaseDraft()
    expect(draft).not.toBeNull()
    // Sem arquivo selecionado → sem hadDocumentSelection.
    expect(draft?.hadDocumentSelection).toBeUndefined()
    // Exatamente as chaves permitidas do rascunho.
    expect(Object.keys(draft ?? {}).sort()).toEqual(
      ['createdAt', 'data', 'type', 'updatedAt', 'version'].sort(),
    )
    expect(Object.keys(draft?.data ?? {}).sort()).toEqual(
      [
        'brand',
        'category',
        'model',
        'price',
        'productName',
        'purchaseDate',
        'serialNumber',
        'store',
      ].sort(),
    )
    // Nenhum valor binário/base64 em nenhuma chave do localStorage.
    expect(localStorageHasFileLikeValue()).toEqual([])
    expect(localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY)).not.toMatch(
      /base64|blob:|File/,
    )
  })
})

describe('AddPurchase — authenticated: fluxo de documento preservado (Etapa 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('authenticated pode selecionar arquivo e faz upload + extração', async () => {
    mockCreatePurchase.mockResolvedValue(createdPurchase)
    mockUpload.mockResolvedValue({
      id: 'doc-1',
      purchaseId: createdPurchase.id,
      name: 'nota',
      fileName: 'nota.pdf',
      mimeType: 'application/pdf',
      size: 12,
      type: 'INVOICE',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
    })
    mockExtract.mockResolvedValue({
      productName: 'Notebook Dell XPS 15',
      brand: 'Dell',
      model: 'XPS 15 9530',
      purchaseDate: '2026-01-15',
      price: 8749.9,
      store: 'Magazine Luiza',
      invoiceNumber: null,
      warrantyMonths: null,
    })

    const { user } = renderAddPurchase('authenticated')

    await fillForm(user)
    await selectInvoiceFile(user)
    expect(screen.getByText('Nota fiscal selecionada')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(1))
    // Purchase criada uma única vez e documento enviado uma única vez.
    expect(mockCreatePurchase).toHaveBeenCalledTimes(1)
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })

  it('authenticated NÃO é bloqueado pelo bloco guest (sem mensagem de login)', () => {
    renderAddPurchase('authenticated')

    expect(
      screen.queryByText(/Entre na sua conta para anexar documentos/),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar nota fiscal' })).toBeEnabled()
  })

  it('guest não vê "Nota fiscal selecionada" pois o input está bloqueado', () => {
    renderAddPurchase('guest')

    expect(screen.queryByText('Nota fiscal selecionada')).not.toBeInTheDocument()
  })
})

describe('AddPurchase — arquivo NÃO é preservado no rascunho (Etapa 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('Cenário B: guest seleciona arquivo e salva → draft registra só um booleano', async () => {
    // O input guest está bloqueado, então simulamos o cenário de transporte de
    // evidência via API do serviço (o AddPurchase passa invoiceFile !== null).
    renderAddPurchase('guest')

    // Guest não consegue escolher arquivo — confirma que o fluxo real de guest
    // nunca gera hadDocumentSelection a partir de um input desabilitado.
    const input = screen.getByLabelText('Selecionar nota fiscal')
    expect(input).toBeDisabled()

    // Mesmo que houvesse um arquivo, `hadDocumentSelection` seria apenas `true`.
    const draft = saveGuestPurchaseDraft(FIELDS, Date.now(), true)
    expect(draft.hadDocumentSelection).toBe(true)
    // E o valor persistido não contém conteúdo do arquivo.
    const raw = localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY) ?? ''
    expect(raw).toContain('"hadDocumentSelection":true')
    expect(raw).not.toMatch(/base64|blob:|\.pdf|%PDF/)
    expect(localStorageHasFileLikeValue()).toEqual([])
  })

  it('draft legado (sem hadDocumentSelection) continua válido', () => {
    localStorage.setItem(
      GUEST_PURCHASE_DRAFT_KEY,
      JSON.stringify({
        version: 1,
        type: 'purchase',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: FIELDS,
      }),
    )

    const draft = getGuestPurchaseDraft()
    expect(draft?.data).toEqual(FIELDS)
    expect(draft?.hadDocumentSelection).toBeUndefined()
  })

  it('draft com hadDocumentSelection inválido (não booleano) é descartado', () => {
    localStorage.setItem(
      GUEST_PURCHASE_DRAFT_KEY,
      JSON.stringify({
        version: 1,
        type: 'purchase',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: FIELDS,
        hadDocumentSelection: 'nota.pdf',
      }),
    )

    expect(getGuestPurchaseDraft()).toBeNull()
  })
})

describe('AddPurchase — aviso de arquivo perdido após restauração (Etapa 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('Cenário A: restauração SEM arquivo NÃO mostra o aviso', () => {
    saveGuestPurchaseDraft(FIELDS)

    renderAddPurchase('authenticated')

    expect(screen.getByText('Compra restaurada')).toBeInTheDocument()
    expect(
      screen.queryByText(/o arquivo da nota fiscal precisa ser selecionado novamente/),
    ).not.toBeInTheDocument()
  })

  it('Cenário B: restauração COM evidência de arquivo mostra o aviso', () => {
    saveGuestPurchaseDraft(FIELDS, Date.now(), true)

    renderAddPurchase('authenticated')

    expect(screen.getByText('Compra restaurada')).toBeInTheDocument()
    expect(
      screen.getByText(/o arquivo da nota fiscal precisa ser selecionado novamente/),
    ).toBeInTheDocument()
    // O aviso não é um erro: é informativo (não usa role=alert).
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('Cenário A: restauração não chama nenhuma API automaticamente', () => {
    saveGuestPurchaseDraft(FIELDS, Date.now(), true)

    renderAddPurchase('authenticated')

    expect(mockCreatePurchase).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockExtract).not.toHaveBeenCalled()
    expect(mockConfirmExtraction).not.toHaveBeenCalled()
  })
})
