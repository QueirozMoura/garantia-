// Testes do modo de acesso progressivo na página de Documentos.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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

/** Espelha o estado que o Login usa para decidir o destino pós-login. */
interface LoginLocationState {
  from?: { pathname?: string }
}

/** Renderiza a página guest e expõe o `state` recebido pela rota /login. */
function renderGuestWithLoginProbe() {
  function LoginProbe() {
    const location = useLocation()
    const state = location.state as LoginLocationState | null
    return <span data-testid="login-from">{state?.from?.pathname ?? 'sem-retorno'}</span>
  }

  return render(
    <AuthContext.Provider value={makeAuthValue('guest')}>
      <MemoryRouter initialEntries={['/documents']}>
        <Routes>
          <Route path="/documents" element={<Documents />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
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
      screen.getByRole('heading', { name: 'Seus documentos ficam aqui' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Entre na sua conta para acessar e organizar seus documentos.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('o CTA Entrar preserva o retorno para /documents', async () => {
    const user = userEvent.setup()
    renderGuestWithLoginProbe()

    await user.click(screen.getByRole('link', { name: 'Entrar' }))

    expect(screen.getByTestId('login-from')).toHaveTextContent('/documents')
  })

  it('authenticated continua buscando os documentos', async () => {
    mockGetDocuments.mockResolvedValue([])

    renderPage('authenticated')

    await waitFor(() => expect(mockGetDocuments).toHaveBeenCalledTimes(1))
  })
})
