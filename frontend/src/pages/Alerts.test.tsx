// Testes do modo de acesso progressivo na página de Alertas.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { MemoryRouter } from 'react-router-dom'
import { getAlerts } from '../lib/api.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import { Alerts } from './Alerts.tsx'

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return {
    ...actual,
    getAlerts: vi.fn(),
  }
})

const mockGetAlerts = vi.mocked(getAlerts)

function renderPage(
  status: 'guest' | 'authenticated' | 'loading',
  auth: Partial<AuthContextValue> = {},
) {
  const value = makeAuthValue(status, auth)
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/alerts']}>
        <Alerts />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Alerts — modo visitante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guest NÃO chama getAlerts', async () => {
    renderPage('guest')

    await waitFor(() => expect(mockGetAlerts).not.toHaveBeenCalled())
  })

  it('guest renderiza o estado de visitante com CTAs de autenticação', () => {
    renderPage('guest')

    expect(
      screen.getByRole('heading', { name: 'Seus alertas aparecem aqui.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('authenticated continua buscando os alertas', async () => {
    mockGetAlerts.mockResolvedValue([])

    renderPage('authenticated')

    await waitFor(() => expect(mockGetAlerts).toHaveBeenCalledTimes(1))
  })

  it('o link "Ver compra" do alerta aponta para a seção de garantia da compra', async () => {
    mockGetAlerts.mockResolvedValue([
      {
        id: 'alert-1',
        type: 'WARRANTY_EXPIRING',
        title: 'Garantia vencendo',
        message: 'Sua garantia está perto do fim.',
        createdAt: '2026-01-10T00:00:00.000Z',
        warranty: {
          id: 'warranty-1',
          purchaseId: 'p-7',
          startDate: '2025-01-10T00:00:00.000Z',
          endDate: '2026-02-10T00:00:00.000Z',
        },
        purchase: {
          id: 'p-7',
          productName: 'Notebook Ultra',
          brand: 'Dell',
          model: 'XPS',
          category: 'Informática',
        },
      },
    ])

    renderPage('authenticated')

    const links = await screen.findAllByRole('link', { name: /ver compra/i })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/purchases/p-7#warranty')
    }
  })
})
