// Testes do modo de acesso progressivo na página de Garantias.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { MemoryRouter } from 'react-router-dom'
import { getWarranties } from '../lib/api.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import { Warranties } from './Warranties.tsx'

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return {
    ...actual,
    getWarranties: vi.fn(),
  }
})

const mockGetWarranties = vi.mocked(getWarranties)

function renderPage(
  status: 'guest' | 'authenticated' | 'loading',
  auth: Partial<AuthContextValue> = {},
) {
  const value = makeAuthValue(status, auth)
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/warranties']}>
        <Warranties />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Warranties — modo visitante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guest NÃO chama getWarranties', async () => {
    renderPage('guest')

    await waitFor(() => expect(mockGetWarranties).not.toHaveBeenCalled())
  })

  it('guest renderiza o estado de visitante com CTAs de autenticação', () => {
    renderPage('guest')

    expect(
      screen.getByRole('heading', { name: 'Suas garantias ficam aqui.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('authenticated continua buscando as garantias', async () => {
    mockGetWarranties.mockResolvedValue([])

    renderPage('authenticated')

    await waitFor(() => expect(mockGetWarranties).toHaveBeenCalledTimes(1))
  })
})
