// Testes do Header nos três estados de sessão e, principalmente, do DESTINO do
// logout com o modelo de acesso progressivo:
//   - rota pública  → permanece na rota (vira guest, sem navegar);
//   - rota privada  → vai para /login preservando `from`.
//
// Usamos um AuthContext controlado (sem <AuthProvider>) para fixar o status e
// observar o `logout`. A navegação é observada por uma rota-sentinela /login.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../../contexts/auth-context.ts'
import { Header } from './Header.tsx'

function makeValue(
  status: AuthContextValue['status'],
  logout: AuthContextValue['logout'],
): AuthContextValue {
  return {
    user:
      status === 'authenticated'
        ? {
            id: 'user-1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            createdAt: '',
            updatedAt: '',
          }
        : null,
    status,
    isAuthenticated: status === 'authenticated',
    isGuest: status === 'guest',
    isLoading: status === 'loading',
    logout,
    expireSession: vi.fn(),
    setUser: vi.fn(),
  }
}

function renderHeader(
  status: AuthContextValue['status'],
  entry: string,
  logout = vi.fn().mockResolvedValue(undefined),
) {
  return render(
    <AuthContext.Provider value={makeValue(status, logout)}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          <Route path="*" element={<Header pageTitle="Página" />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

async function logoutFromMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Abrir menu do usuário' }))
  await user.click(screen.getByRole('menuitem', { name: /Sair/ }))
}

describe('Header — estados de sessão', () => {
  it('guest mostra "Modo visitante" e "Entrar", sem menu nem Sair', () => {
    renderHeader('guest', '/dashboard')

    expect(screen.getByText('Modo visitante')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Abrir menu do usuário' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Sair/ })).not.toBeInTheDocument()
  })

  it('loading não mostra dados de usuário nem "Modo visitante"', () => {
    renderHeader('loading', '/dashboard')

    expect(screen.queryByText('Modo visitante')).not.toBeInTheDocument()
    // Sem usuário: não inventa avatar/menu de usuário.
    expect(
      screen.queryByRole('button', { name: 'Abrir menu do usuário' }),
    ).not.toBeInTheDocument()
  })

  it('authenticated mostra o menu do usuário com a opção Sair', () => {
    renderHeader('authenticated', '/dashboard')

    expect(screen.queryByText('Modo visitante')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Abrir menu do usuário' }),
    ).toBeInTheDocument()
  })
})

describe('Header — destino do logout', () => {
  it('em rota pública permanece na mesma rota (não navega para /login)', async () => {
    const user = userEvent.setup()
    const logout = vi.fn().mockResolvedValue(undefined)
    renderHeader('authenticated', '/purchases', logout)

    await logoutFromMenu(user)

    expect(logout).toHaveBeenCalledOnce()
    // Continua no shell da página pública (Header presente), sem cair no /login.
    expect(screen.queryByText('LOGIN_PAGE')).not.toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it.each([
    '/dashboard',
    '/purchases',
    '/purchases/new',
    '/warranties',
    '/documents',
    '/alerts',
  ])('a rota pública %s é visitável por guest após o logout', async (route) => {
    const user = userEvent.setup()
    renderHeader('authenticated', route)

    await logoutFromMenu(user)

    expect(screen.queryByText('LOGIN_PAGE')).not.toBeInTheDocument()
  })

  it.each([
    '/purchases/purchase-42',
    '/purchases/purchase-42/edit',
    '/purchases/new/confirm',
  ])('a rota privada %s leva ao /login após o logout', async (route) => {
    const user = userEvent.setup()
    renderHeader('authenticated', route)

    await logoutFromMenu(user)

    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument()
  })
})
