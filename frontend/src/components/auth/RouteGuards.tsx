import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated } from '../../services/auth.ts'

interface RequireAuthProps {
  children: ReactNode
}

/** Rota protegida: sem access token, redireciona para /login. */
export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

interface RequireGuestProps {
  children: ReactNode
}

/** Rota de convidado: autenticado, redireciona para /dashboard. */
export function RequireGuest({ children }: RequireGuestProps) {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
