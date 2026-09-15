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
})
