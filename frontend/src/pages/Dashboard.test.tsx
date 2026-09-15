// Testes do modo de acesso progressivo na Dashboard.
//
// Verificam que, em guest, NENHUMA chamada privada acontece (getDashboard não é
// chamado) e que o estado de visitante é renderizado; e que, em authenticated,
// o comportamento original (buscar getDashboard) é preservado.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { getDashboard } from '../lib/api.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard.tsx'
import type { DashboardResponse } from '../types/dashboard.ts'

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return {
    ...actual,
    getDashboard: vi.fn(),
  }
})

const mockGetDashboard = vi.mocked(getDashboard)

const emptyDashboard: DashboardResponse['dashboard'] = {
  summary: {
    totalPurchases: 0,
    totalWarranties: 0,
    activeWarranties: 0,
    totalSpent: '0.00',
  },
  expiringWarranties: [],
  recentPurchases: [],
}

function renderDashboard(
  status: 'guest' | 'authenticated' | 'loading',
  auth: Partial<AuthContextValue> = {},
) {
  const value = makeAuthValue(status, auth)
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Dashboard — modo visitante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guest NÃO chama getDashboard', async () => {
    renderDashboard('guest')

    // Dá tempo a efeitos que (por engano) disparariam a requisição.
    await waitFor(() => expect(mockGetDashboard).not.toHaveBeenCalled())
  })

  it('guest renderiza o estado de visitante com CTAs de autenticação', () => {
    renderDashboard('guest')

    expect(
      screen.getByRole('heading', {
        name: 'Organize suas compras. Proteja suas garantias.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('guest não mostra números/valores do produto', () => {
    renderDashboard('guest')

    expect(screen.queryByText('Compras cadastradas')).not.toBeInTheDocument()
    expect(screen.queryByText('Total gasto')).not.toBeInTheDocument()
  })

  it('authenticated continua buscando a Dashboard', async () => {
    mockGetDashboard.mockResolvedValue(emptyDashboard)

    renderDashboard('authenticated')

    await waitFor(() => expect(mockGetDashboard).toHaveBeenCalledTimes(1))
  })

  it('loading não chama getDashboard e mostra o skeleton', () => {
    renderDashboard('loading')

    expect(mockGetDashboard).not.toHaveBeenCalled()
  })
})
