import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/auth-context.ts'

/** Tela de espera enquanto a sessão inicial é verificada (evita "flash" de login). */
function SessionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 antialiased">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-hidden="true" />
      <span className="sr-only">Carregando sessão…</span>
    </div>
  )
}

interface RequireAuthProps {
  children: ReactNode
}

/**
 * Rota protegida: aguarda a verificação da sessão; se não autenticado,
 * redireciona para /login.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation()
  const { status } = useAuth()

  if (status === 'loading') {
    return <SessionLoading />
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

interface RequireGuestProps {
  children: ReactNode
}

/** Rota de convidado: aguarda a sessão; se autenticado, vai para /dashboard. */
export function RequireGuest({ children }: RequireGuestProps) {
  const { status } = useAuth()

  if (status === 'loading') {
    return <SessionLoading />
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
