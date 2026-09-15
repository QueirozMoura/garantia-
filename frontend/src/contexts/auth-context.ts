import { createContext, useContext } from 'react'
import type { AuthUser } from '../types/auth.ts'

export type AuthStatus = 'loading' | 'guest' | 'authenticated'

export interface AuthContextValue {
  /** Usuário autenticado vindo de GET /auth/me. `null` se não autenticado. */
  user: AuthUser | null
  /** Estado explícito da sessão, incluindo visitante legítimo. */
  status: AuthStatus
  isAuthenticated: boolean
  isGuest: boolean
  /** `true` enquanto a sessão inicial está sendo verificada. */
  isLoading: boolean
  /** Encerra a sessão local e no backend, depois limpa o estado global. */
  logout: () => Promise<void>
  /** Atualiza o usuário em memória (ex.: após o login). */
  setUser: (user: AuthUser | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** Acessa o estado global da sessão. Deve ser usado dentro de <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
