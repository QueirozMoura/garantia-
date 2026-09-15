// Testes do modo de acesso progressivo na página de Documentos.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { MemoryRouter } from 'react-router-dom'
import { getDocuments } from '../lib/api.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import { Documents } from './Documents.tsx'

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return {
    ...actual,
    getDocuments: vi.fn(),
  }
})

const mockGetDocuments = vi.mocked(getDocuments)

function renderPage(
  status: 'guest' | 'authenticated' | 'loading',
  auth: Partial<AuthContextValue> = {},
) {
  const value = makeAuthValue(status, auth)
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/documents']}>
        <Documents />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Documents — modo visitante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guest NÃO chama getDocuments', async () => {
    renderPage('guest')

    await waitFor(() => expect(mockGetDocuments).not.toHaveBeenCalled())
  })

  it('guest renderiza o cofre de documentos como estado de visitante', () => {
    renderPage('guest')

    expect(
      screen.getByRole('heading', { name: 'Seu cofre de documentos' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('authenticated continua buscando os documentos', async () => {
    mockGetDocuments.mockResolvedValue([])

    renderPage('authenticated')

    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalledTimes(1))
  })
})
