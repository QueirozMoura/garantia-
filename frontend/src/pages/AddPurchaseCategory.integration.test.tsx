// Testes de integração do fluxo frontend da categoria sugerida pela IA.
//
// Foco: provar que a resposta de `extractDocument` (com `category`) atravessa o
// fluxo real — AddPurchase → ExtractionPreview — e que o usuário consegue:
//  - ver a categoria válida pré-selecionada;
//  - alterar a sugestão para outra categoria da lista;
//  - escolher "Outra" e digitar uma categoria personalizada;
//  - continuar quando a IA não devolve categoria (null).
//
// Nada aqui é persistido: a revisão vive apenas no estado local (o PATCH é da
// etapa de confirmação, coberto em ConfirmExtraction.test.tsx e api.test.ts).
// Nenhum comportamento de produção é alterado — apenas testes adicionados.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { createPurchase, uploadPurchaseDocument, extractDocument } from '../lib/api.ts'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import { AddPurchase } from './AddPurchase.tsx'
import type { DocumentExtraction } from '../types/document.ts'

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return {
    ...actual,
    createPurchase: vi.fn(),
    uploadPurchaseDocument: vi.fn(),
    extractDocument: vi.fn(),
  }
})

const mockCreatePurchase = vi.mocked(createPurchase)
const mockUpload = vi.mocked(uploadPurchaseDocument)
const mockExtract = vi.mocked(extractDocument)

const createdPurchase = {
  id: 'purchase-1',
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  serialNumber: null,
  store: 'Magazine Luiza',
  purchaseDate: '2026-01-15',
  price: '8749.90',
  category: 'Informática',
  warranty: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
}

const uploadedDocument = {
  id: 'doc-1',
  purchaseId: createdPurchase.id,
  name: 'nota',
  fileName: 'nota.pdf',
  mimeType: 'application/pdf',
  size: 12,
  type: 'INVOICE' as const,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
}

const extractionResponse = (
  overrides: Partial<DocumentExtraction> = {},
): DocumentExtraction => ({
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  purchaseDate: '2026-01-15',
  price: 8749.9,
  store: 'Magazine Luiza',
  invoiceNumber: null,
  warrantyMonths: null,
  category: null,
  ...overrides,
})

/** Espelha a navegação da etapa de revisão exibindo os dados recebidos. */
function ReviewEcho() {
  const location = useLocation()
  const reviewed = (location.state as { extraction?: DocumentExtraction } | null)
    ?.extraction
  return <div data-testid="review-echo">{reviewed?.category ?? 'SEM_CATEGORIA'}</div>
}

function renderAddPurchase(status: 'guest' | 'authenticated' = 'authenticated') {
  const user = userEvent.setup()
  const auth: Partial<AuthContextValue> = {}
  const utils = render(
    <AuthContext.Provider value={makeAuthValue(status, auth)}>
      <MemoryRouter initialEntries={['/purchases/new']}>
        <Routes>
          <Route path="/purchases/new" element={<AddPurchase />} />
          <Route path="/purchases/new/confirm" element={<ReviewEcho />} />
          <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { user, ...utils }
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Nome do produto/), 'Notebook Dell XPS 15')
  await user.type(screen.getByLabelText('Marca'), 'Dell')
  await user.type(screen.getByLabelText('Modelo'), 'XPS 15 9530')
  await user.type(screen.getByLabelText('Loja'), 'Magazine Luiza')
  await user.type(screen.getByLabelText(/Data da compra/), '2026-01-15')
  await user.type(screen.getByLabelText(/Preço/), '8749.90')
  await user.selectOptions(screen.getByLabelText(/Categoria/), 'Informática')
}

async function selectInvoiceFile(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText('Selecionar nota fiscal')
  const file = new File(['%PDF-1.4 nota'], 'nota.pdf', { type: 'application/pdf' })
  await user.upload(input, file)
}

/** Executa o fluxo real até a etapa de revisão com a extração configurada. */
async function runToReview(category: string | null) {
  mockCreatePurchase.mockResolvedValue(createdPurchase)
  mockUpload.mockResolvedValue(uploadedDocument)
  mockExtract.mockResolvedValue(extractionResponse({ category }))

  const { user } = renderAddPurchase()
  await fillForm(user)
  await selectInvoiceFile(user)
  await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

  // A revisão só aparece quando `extractDocument` já foi chamado e resolvido.
  await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(1))
  await screen.findByLabelText('Categoria')

  return { user }
}

describe('AddPurchase → ExtractionPreview — categoria sugerida pela IA (integração)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('pré-seleciona a categoria válida devolvida por extractDocument', async () => {
    const { user } = await runToReview('Informática')

    // `extractDocument` devolveu a categoria e ela foi selecionada na revisão.
    await expect(mockExtract.mock.results[0]?.value).resolves.toMatchObject({
      category: 'Informática',
    })
    expect(screen.getByLabelText('Categoria')).toHaveValue('Informática')

    // Continuar repassa exatamente a categoria sugerida, sem alteração.
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByTestId('review-echo')).toHaveTextContent('Informática')
  })

  it('não pré-seleciona nada quando extractDocument devolve categoria null', async () => {
    await runToReview(null)

    expect(screen.getByLabelText('Categoria')).toHaveValue('')
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('permite alterar a sugestão da IA para outra categoria da lista', async () => {
    const { user } = await runToReview('Informática')

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Eletrônicos')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByTestId('review-echo')).toHaveTextContent('Eletrônicos')
  })

  it('permite escolher "Outra" e informar uma categoria personalizada', async () => {
    const { user } = await runToReview('Informática')

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Outra')
    await user.type(
      screen.getByLabelText('Categoria personalizada'),
      'Instrumentos musicais',
    )
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByTestId('review-echo')).toHaveTextContent(
      'Instrumentos musicais',
    )
  })
})
