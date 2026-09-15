import { vi } from 'vitest'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from '../contexts/auth-context.ts'
import type { AuthUser } from '../types/auth.ts'

export const TEST_USER: AuthUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

/** Valor de AuthContext completo e determinístico para os testes de página. */
export function makeAuthValue(
  status: AuthStatus,
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    user: status === 'authenticated' ? TEST_USER : null,
    status,
    isAuthenticated: status === 'authenticated',
    isGuest: status === 'guest',
    isLoading: status === 'loading',
    logout: vi.fn(),
    setUser: vi.fn(),
    ...overrides,
  }
}

interface RenderWithAuthOptions {
  status: AuthStatus
  /** Rota inicial dentro do MemoryRouter. */
  initialEntries?: string[]
  /** Sobrescreve partes do AuthContext (ex.: `setUser`). */
  auth?: Partial<AuthContextValue>
}

/**
 * Monta qualquer UI com um AuthContext controlado. Não provê <AuthProvider>:
 * o objetivo é fixar `status` para exercitar os ramos guest/authenticated das
 * páginas sem chamadas reais de sessão.
 */
export function withAuthProvider(
  children: ReactNode,
  { status, initialEntries = ['/'], auth }: RenderWithAuthOptions,
) {
  const value = makeAuthValue(status, auth)
  return (
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </AuthContext.Provider>
  )
}
