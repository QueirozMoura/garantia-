import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  fetchCurrentUser,
  hasStoredSession,
  logout as logoutSession,
} from '../services/auth.ts'
import type { AuthUser } from '../types/auth.ts'
import { AuthContext, type AuthContextValue } from './auth-context.ts'

/**
 * Estado global da sessão.
 *
 * Na montagem verifica se existe um access token armazenado:
 *  - sem token  → usuário não autenticado, sem chamar /auth/me;
 *  - com token  → chama GET /auth/me para obter o usuário real.
 * Um 401 limpa o token silenciosamente (sem refresh automático nesta etapa).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    const init = async () => {
      if (!hasStoredSession()) {
        if (isActive) {
          setUser(null)
          setIsLoading(false)
        }
        return
      }

      try {
        const currentUser = await fetchCurrentUser()
        if (isActive) setUser(currentUser)
      } catch {
        // Falha de rede durante a verificação: mantém o usuário sem sessão
        // sem exibir erro; o RequireAuth direciona para /login.
        if (isActive) setUser(null)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void init()

    return () => {
      isActive = false
    }
  }, [])

  const logout = useCallback(async () => {
    await logoutSession()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      logout,
      setUser,
    }),
    [user, isLoading, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
