import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext.tsx'
import { useAuth } from './auth-context.ts'
import type { AuthUser } from '../types/auth.ts'

const { mockFetchCurrentUser, mockHasStoredSession, mockLogout } = vi.hoisted(() => ({
  mockFetchCurrentUser: vi.fn(),
  mockHasStoredSession: vi.fn(),
  mockLogout: vi.fn(),
}))

vi.mock('../services/auth.ts', () => ({
  fetchCurrentUser: mockFetchCurrentUser,
  hasStoredSession: mockHasStoredSession,
  logout: mockLogout,
}))

const user: AuthUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function AuthStateProbe() {
  const auth = useAuth()

  return (
    <output
      data-testid="auth-state"
      data-status={auth.status}
      data-user={auth.user?.id ?? ''}
      data-authenticated={String(auth.isAuthenticated)}
      data-guest={String(auth.isGuest)}
      data-loading={String(auth.isLoading)}
    />
  )
}

function renderAuthProvider() {
  return render(
    <AuthProvider>
      <AuthStateProbe />
    </AuthProvider>,
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('entra em guest sem access token', async () => {
    mockHasStoredSession.mockReturnValue(false)
    const { getByTestId } = renderAuthProvider()

    await act(async () => {})

    const state = getByTestId('auth-state')
    expect(state).toHaveAttribute('data-status', 'guest')
    expect(state).toHaveAttribute('data-user', '')
    expect(state).toHaveAttribute('data-authenticated', 'false')
    expect(state).toHaveAttribute('data-guest', 'true')
    expect(state).toHaveAttribute('data-loading', 'false')
    expect(mockFetchCurrentUser).not.toHaveBeenCalled()
  })

  it('entra em authenticated quando /auth/me retorna um usuário', async () => {
    mockHasStoredSession.mockReturnValue(true)
    mockFetchCurrentUser.mockResolvedValue(user)
    const { getByTestId } = renderAuthProvider()

    await act(async () => {})

    const state = getByTestId('auth-state')
    expect(state).toHaveAttribute('data-status', 'authenticated')
    expect(state).toHaveAttribute('data-user', user.id)
    expect(state).toHaveAttribute('data-authenticated', 'true')
    expect(state).toHaveAttribute('data-guest', 'false')
    expect(state).toHaveAttribute('data-loading', 'false')
  })

  it('volta para guest quando a verificação da sessão falha e limpa o token', async () => {
    localStorage.setItem('access_token', 'token-expirado')
    mockHasStoredSession.mockReturnValue(true)
    mockFetchCurrentUser.mockRejectedValue(new Error('session expired'))
    const { getByTestId } = renderAuthProvider()

    await act(async () => {})

    const state = getByTestId('auth-state')
    expect(state).toHaveAttribute('data-status', 'guest')
    expect(state).toHaveAttribute('data-user', '')
    expect(state).toHaveAttribute('data-authenticated', 'false')
    expect(state).toHaveAttribute('data-guest', 'true')
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('permanece em loading enquanto a sessão é verificada', async () => {
    let resolveSession: (value: AuthUser) => void = () => undefined
    const sessionPromise = new Promise<AuthUser>((resolve) => {
      resolveSession = resolve
    })
    mockHasStoredSession.mockReturnValue(true)
    mockFetchCurrentUser.mockReturnValue(sessionPromise)
    renderAuthProvider()

    expect(screen.getByTestId('auth-state')).toHaveAttribute('data-status', 'loading')
    expect(screen.getByTestId('auth-state')).toHaveAttribute('data-loading', 'true')

    await act(async () => {
      resolveSession(user)
      await sessionPromise
    })

    expect(screen.getByTestId('auth-state')).toHaveAttribute(
      'data-status',
      'authenticated',
    )
  })

  it('muda para guest depois do logout', async () => {
    mockHasStoredSession.mockReturnValue(true)
    mockFetchCurrentUser.mockResolvedValue(user)

    function LogoutProbe() {
      const auth = useAuth()
      return (
        <>
          <AuthStateProbe />
          <button type="button" onClick={() => void auth.logout()}>
            Sair
          </button>
        </>
      )
    }

    const { getByRole, getByTestId } = render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    )

    await act(async () => {})
    await act(async () => {
      getByRole('button', { name: 'Sair' }).click()
    })

    const state = getByTestId('auth-state')
    expect(state).toHaveAttribute('data-status', 'guest')
    expect(state).toHaveAttribute('data-user', '')
    expect(state).toHaveAttribute('data-authenticated', 'false')
    expect(state).toHaveAttribute('data-guest', 'true')
    expect(mockLogout).toHaveBeenCalledOnce()
  })

  it('nunca combina user preenchido com status guest (nem o inverso)', async () => {
    mockHasStoredSession.mockReturnValue(true)
    mockFetchCurrentUser.mockResolvedValue(user)
    const { getByTestId } = renderAuthProvider()

    await act(async () => {})

    const state = getByTestId('auth-state')
    // authenticated ⟺ user preenchido ⟺ flags coerentes.
    const status = state.getAttribute('data-status')
    const hasUser = state.getAttribute('data-user') !== ''
    expect(status === 'authenticated').toBe(hasUser)
    expect(state).toHaveAttribute(
      'data-authenticated',
      String(status === 'authenticated'),
    )
    expect(state).toHaveAttribute('data-guest', String(status === 'guest'))
    expect(state).toHaveAttribute('data-loading', String(status === 'loading'))
  })

  it('expireSession leva a guest sem chamar o backend (logout) e limpa o usuário', async () => {
    mockHasStoredSession.mockReturnValue(true)
    mockFetchCurrentUser.mockResolvedValue(user)

    function ExpireProbe() {
      const auth = useAuth()
      return (
        <>
          <AuthStateProbe />
          <button type="button" onClick={() => auth.expireSession()}>
            Expirar
          </button>
        </>
      )
    }

    const { getByRole, getByTestId } = render(
      <AuthProvider>
        <ExpireProbe />
      </AuthProvider>,
    )

    await act(async () => {})
    expect(getByTestId('auth-state')).toHaveAttribute('data-status', 'authenticated')

    await act(async () => {
      getByRole('button', { name: 'Expirar' }).click()
    })

    const state = getByTestId('auth-state')
    expect(state).toHaveAttribute('data-status', 'guest')
    expect(state).toHaveAttribute('data-user', '')
    expect(state).toHaveAttribute('data-authenticated', 'false')
    expect(state).toHaveAttribute('data-guest', 'true')
    // Expiração por 401 NÃO notifica o backend.
    expect(mockLogout).not.toHaveBeenCalled()
  })
})
