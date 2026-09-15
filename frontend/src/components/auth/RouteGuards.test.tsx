import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../../contexts/auth-context.ts'
import { RequireAuth, RequireGuest } from './RouteGuards.tsx'

const authValue = (status: AuthContextValue['status']): AuthContextValue => ({
  user:
    status === 'authenticated'
      ? {
          id: 'user-1',
          name: 'Ada',
          email: 'ada@example.com',
          createdAt: '',
          updatedAt: '',
        }
      : null,
  status,
  isAuthenticated: status === 'authenticated',
  isGuest: status === 'guest',
  isLoading: status === 'loading',
  logout: vi.fn(),
  setUser: vi.fn(),
})

function renderGuard(
  element: React.ReactNode,
  value: AuthContextValue,
  initialEntry: string,
) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/protected" element={element} />
          <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          <Route path="/dashboard" element={<div>DASHBOARD_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RouteGuards', () => {
  it('mantém RequireAuth em loading enquanto a sessão é verificada', () => {
    renderGuard(
      <RequireAuth>
        <div>PROTECTED_PAGE</div>
      </RequireAuth>,
      authValue('loading'),
      '/protected',
    )

    expect(screen.getByText('Carregando sessão…')).toBeInTheDocument()
    expect(screen.queryByText('PROTECTED_PAGE')).not.toBeInTheDocument()
  })

  it('permite RequireAuth para authenticated', () => {
    renderGuard(
      <RequireAuth>
        <div>PROTECTED_PAGE</div>
      </RequireAuth>,
      authValue('authenticated'),
      '/protected',
    )

    expect(screen.getByText('PROTECTED_PAGE')).toBeInTheDocument()
  })

  it('mantém o redirecionamento de guest do RequireAuth', () => {
    renderGuard(
      <RequireAuth>
        <div>PROTECTED_PAGE</div>
      </RequireAuth>,
      authValue('guest'),
      '/protected',
    )

    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument()
    expect(screen.queryByText('PROTECTED_PAGE')).not.toBeInTheDocument()
  })

  it('permite RequireGuest para guest e redireciona authenticated', () => {
    const { unmount } = renderGuard(
      <RequireGuest>
        <div>AUTH_PAGE</div>
      </RequireGuest>,
      authValue('guest'),
      '/protected',
    )
    expect(screen.getByText('AUTH_PAGE')).toBeInTheDocument()

    unmount()
    renderGuard(
      <RequireGuest>
        <div>AUTH_PAGE</div>
      </RequireGuest>,
      authValue('authenticated'),
      '/protected',
    )
    expect(screen.getByText('DASHBOARD_PAGE')).toBeInTheDocument()
  })
})
