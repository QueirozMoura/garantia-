// Testes do modo de acesso progressivo na página de Compras.
//
// Em guest, getPurchases NÃO pode ser chamado e o estado de visitante deve
// aparecer. Em authenticated, o comportamento original é preservado.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getPurchases } from '../lib/api.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import { Purchases } from './Purchases.tsx'

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return {
    ...actual,
    getPurchases: vi.fn(),
  }
})

const mockGetPurchases = vi.mocked(getPurchases)

function renderPage(
  status: 'guest' | 'authenticated' | 'loading',
  auth: Partial<AuthContextValue> = {},
) {
  const value = makeAuthValue(status, auth)
  const user = userEvent.setup()
  const utils = render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/purchases']}>
        <Routes>
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          <Route path="/purchases/new" element={<div>NEW_PURCHASE_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { user, ...utils }
}

describe('Purchases — modo visitante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guest NÃO chama getPurchases', async () => {
    renderPage('guest')

    await waitFor(() => expect(mockGetPurchases).not.toHaveBeenCalled())
  })

  it('guest renderiza o estado de visitante com CTAs de autenticação', () => {
    renderPage('guest')

    expect(
      screen.getByRole('heading', { name: 'Suas compras ficam organizadas aqui.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('guest: "Adicionar compra" NÃO aparece como criação direta', () => {
    renderPage('guest')

    // Nenhum botão de criação de compra é oferecido em guest.
    expect(
      screen.queryByRole('button', { name: /adicionar compra/i }),
    ).not.toBeInTheDocument()
  })

  it('authenticated continua buscando as compras', async () => {
    mockGetPurchases.mockResolvedValue([])

    renderPage('authenticated')

    await waitFor(() => expect(mockGetPurchases).toHaveBeenCalledTimes(1))
  })
})
