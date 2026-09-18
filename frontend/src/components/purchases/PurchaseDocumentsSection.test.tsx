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
import { ApiError, extractDocument, getPurchaseDocuments } from '../../lib/api.ts'
import { AuthContext, type AuthContextValue } from '../../contexts/auth-context.ts'
import type { Document } from '../../types/document.ts'
import { PurchaseDocumentsSection } from './PurchaseDocumentsSection.tsx'

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api.ts')>()
  return {
    ...actual,
    getPurchaseDocuments: vi.fn(),
    extractDocument: vi.fn(),
  }
})

const mockGetDocuments = vi.mocked(getPurchaseDocuments)
const mockExtract = vi.mocked(extractDocument)

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
