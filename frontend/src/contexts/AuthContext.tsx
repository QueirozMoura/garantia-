import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  fetchCurrentUser,
  hasStoredSession,
  logout as logoutSession,
} from '../services/auth.ts'
import type { AuthUser } from '../types/auth.ts'
import { clearStoredAccessToken } from '../lib/api.ts'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context.ts'

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
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let isActive = true

    const init = async () => {
      if (!hasStoredSession()) {
        if (isActive) {
          setUser(null)
          setStatus('guest')
        }
        return
      }

      try {
        const currentUser = await fetchCurrentUser()
        if (isActive) {
          setUser(currentUser)
          setStatus(currentUser ? 'authenticated' : 'guest')
        }
      } catch {
        // Qualquer falha que não seja recuperada pelo fluxo de refresh encerra
        // a sessão local e deixa o usuário no estado visitante.
        clearStoredAccessToken()
        if (isActive) {
          setUser(null)
          setStatus('guest')
        }
      }
    }

    void init()

    return () => {
      isActive = false
    }
  }, [])

  /**
   * Transição única para o estado visitante. `user` e `status` mudam SEMPRE em
   * par, o que impede a combinação incoerente `user` preenchido + status guest
   * (ou o inverso). Nenhum rascunho local é tocado aqui.
   */
  const goToGuest = useCallback(() => {
    setUser(null)
    setStatus('guest')
  }, [])

  const logout = useCallback(async () => {
    await logoutSession()
    goToGuest()
  }, [goToGuest])

  /**
   * Sessão expirada/inválida detectada pela camada de API (401 já sem refresh
   * possível). Não chama o backend: apenas consolida o estado visitante.
   */
  const expireSession = useCallback(() => {
    goToGuest()
  }, [goToGuest])

  const updateUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser)
    setStatus(nextUser ? 'authenticated' : 'guest')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isGuest: status === 'guest',
      isLoading: status === 'loading',
      logout,
      expireSession,
      setUser: updateUser,
    }),
    [user, status, logout, expireSession, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
