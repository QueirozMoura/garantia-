// Testes da seção "Cofre de documentos" (PurchaseDocumentsSection), focados no
// fluxo "Ler nota com IA" quando o documento não existe mais no backend (404).
//
// Executamos o componente REAL e mockamos apenas as funções públicas de
// src/lib/api.ts (sem request real, sem backend). Os erros usam as classes
// REAIS `ApiError`/`AuthenticationError` para o componente exercitar seu
// tratamento.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import {
  ApiError,
  deleteDocument,
  extractDocument,
  getPurchaseDocuments,
} from '../../lib/api.ts'
import { AuthContext, type AuthContextValue } from '../../contexts/auth-context.ts'
import type { Document } from '../../types/document.ts'
import { PurchaseDocumentsSection } from './PurchaseDocumentsSection.tsx'

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api.ts')>()
  return {
    ...actual,
    getPurchaseDocuments: vi.fn(),
    extractDocument: vi.fn(),
    deleteDocument: vi.fn(),
  }
})

const mockGetDocuments = vi.mocked(getPurchaseDocuments)
const mockExtract = vi.mocked(extractDocument)
const mockDelete = vi.mocked(deleteDocument)

const PURCHASE_ID = 'purchase-7'

const makeDocument = (overrides: Partial<Document> = {}): Document => ({
  id: 'doc-1',
  purchaseId: PURCHASE_ID,
  name: 'Nota fiscal',
  fileName: 'nota.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  type: 'INVOICE',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  ...overrides,
})

describe('PurchaseDocumentsSection — extração com documento inexistente (404)', () => {
  let expireSession: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    expireSession = vi.fn()
  })

  const renderSection = () => {
    const user = userEvent.setup()
    const authValue: AuthContextValue = {
      user: null,
      status: 'authenticated',
      isAuthenticated: true,
      isGuest: false,
      isLoading: false,
      logout: vi.fn(),
      expireSession,
      setUser: vi.fn(),
    }
    const utils = render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/purchases/' + PURCHASE_ID]}>
          <Routes>
            <Route
              path="/purchases/:id"
              element={<PurchaseDocumentsSection purchaseId={PURCHASE_ID} />}
            />
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    return { user, ...utils }
  }

  it('404 na extração: remove o documento da lista e mantém a mensagem amigável', async () => {
    const document = makeDocument({ id: 'doc-stale', name: 'Nota antiga' })
    mockGetDocuments.mockResolvedValue([document])
    mockExtract.mockRejectedValue(
      new ApiError('Document not found', 404, 'DOCUMENT_NOT_FOUND'),
    )

    const { user } = renderSection()

    // O documento aparece na lista inicialmente.
    expect(await screen.findByText('Nota antiga')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ler nota com IA/i }))

    // Mantém a mensagem amigável atual.
    expect(
      await screen.findByText('Esta nota fiscal não está mais disponível.'),
    ).toBeInTheDocument()

    // O documento obsoleto deixa de aparecer na lista.
    await waitFor(() => expect(screen.queryByText('Nota antiga')).not.toBeInTheDocument())
    expect(mockExtract).toHaveBeenCalledWith('doc-stale')
    expect(expireSession).not.toHaveBeenCalled()
  })

  it('outros erros (500) NÃO removem o documento da lista', async () => {
    const document = makeDocument({ id: 'doc-ok', name: 'Nota com erro' })
    mockGetDocuments.mockResolvedValue([document])
    mockExtract.mockRejectedValue(new ApiError('boom', 500, 'INTERNAL_ERROR'))

    const { user } = renderSection()

    expect(await screen.findByText('Nota com erro')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ler nota com IA/i }))

    // Mensagem de falha da análise é exibida...
    expect(
      await screen.findByText(
        'Não foi possível analisar a nota fiscal. Tente novamente.',
      ),
    ).toBeInTheDocument()

    // ...e o documento permanece na lista (nenhuma remoção).
    expect(screen.getByText('Nota com erro')).toBeInTheDocument()
  })
})

// A exclusão deixou de usar `window.confirm`: agora há uma confirmação visual
// reutilizável (DeleteDocumentDialog), espelhando os demais diálogos do projeto.
describe('PurchaseDocumentsSection — confirmação de exclusão de documento', () => {
  let expireSession: () => void
  beforeEach(() => {
    vi.clearAllMocks()
    expireSession = vi.fn()
  })

  const renderSection = () => {
    const user = userEvent.setup()
    const authValue: AuthContextValue = {
      user: null,
      status: 'authenticated',
      isAuthenticated: true,
      isGuest: false,
      isLoading: false,
      logout: vi.fn(),
      expireSession,
      setUser: vi.fn(),
    }
    const utils = render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/purchases/' + PURCHASE_ID]}>
          <Routes>
            <Route
              path="/purchases/:id"
              element={<PurchaseDocumentsSection purchaseId={PURCHASE_ID} />}
            />
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    return { user, ...utils }
  }

  /** Botão "Excluir" de um item (aria-label carrega o nome do documento). */
  const deleteButton = (name: string) =>
    screen.getByRole('button', { name: `Excluir documento ${name}` })

  it('clicar em excluir abre a confirmação visual (sem chamar a API)', async () => {
    const document = makeDocument({ id: 'doc-1', name: 'Nota da loja' })
    mockGetDocuments.mockResolvedValue([document])

    const { user } = renderSection()
    await screen.findByText('Nota da loja')

    await user.click(deleteButton('Nota da loja'))

    // O diálogo de confirmação aparece com a ação clara e as duas opções.
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Excluir documento?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Tem certeza que deseja excluir este documento/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Excluir documento' }),
    ).toBeInTheDocument()
    // Nada foi enviado ao backend antes da confirmação.
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('cancelar fecha a confirmação e NÃO chama a exclusão', async () => {
    const document = makeDocument({ id: 'doc-1', name: 'Nota da loja' })
    mockGetDocuments.mockResolvedValue([document])

    const { user } = renderSection()
    await screen.findByText('Nota da loja')

    await user.click(deleteButton('Nota da loja'))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    // Modal fecha e a API de exclusão nunca é chamada.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockDelete).not.toHaveBeenCalled()
    // O documento continua na lista.
    expect(screen.getByText('Nota da loja')).toBeInTheDocument()
  })

  it('confirmar chama a exclusão e remove o documento da lista', async () => {
    const document = makeDocument({ id: 'doc-1', name: 'Nota da loja' })
    mockGetDocuments.mockResolvedValue([document])
    mockDelete.mockResolvedValue(undefined)

    const { user } = renderSection()
    await screen.findByText('Nota da loja')

    await user.click(deleteButton('Nota da loja'))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Excluir documento' }))

    // O fluxo de exclusão existente é chamado com o id do documento.
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('doc-1'))
    expect(mockDelete).toHaveBeenCalledTimes(1)
    // O documento é removido da lista após o sucesso.
    await waitFor(() => expect(screen.queryByText('Nota da loja')).not.toBeInTheDocument())
  })

  it('erro da API mantém o tratamento atual (mensagem amigável) e o modal aberto', async () => {
    const document = makeDocument({ id: 'doc-1', name: 'Nota da loja' })
    mockGetDocuments.mockResolvedValue([document])
    // Erro genérico (não-ApiError): cai na mensagem padrão de exclusão.
    mockDelete.mockRejectedValue(new Error('boom'))

    const { user } = renderSection()
    await screen.findByText('Nota da loja')

    await user.click(deleteButton('Nota da loja'))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Excluir documento' }))

    // A mensagem amigável atual aparece dentro do modal, que segue aberto.
    expect(
      await screen.findByText('Não foi possível excluir o documento.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // O documento permanece na lista até uma exclusão bem-sucedida (o nome
    // aparece no item E no diálogo aberto).
    expect(screen.getAllByText('Nota da loja').length).toBeGreaterThan(0)
    expect(expireSession).not.toHaveBeenCalled()
  })

  it('erro de API (ApiError) exibe a mensagem retornada, mantendo o tratamento atual', async () => {
    const document = makeDocument({ id: 'doc-1', name: 'Nota da loja' })
    mockGetDocuments.mockResolvedValue([document])
    mockDelete.mockRejectedValue(new ApiError('boom', 500, 'INTERNAL_ERROR'))

    const { user } = renderSection()
    await screen.findByText('Nota da loja')

    await user.click(deleteButton('Nota da loja'))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Excluir documento' }))

    // Comportamento inalterado: ApiError → a própria `message` é exibida.
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText('Não foi possível excluir o documento.')).not.toBeInTheDocument()
  })
})
