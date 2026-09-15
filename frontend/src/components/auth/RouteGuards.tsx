import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/auth-context.ts'
import { hasGuestPurchaseDraft } from '../../services/guest-drafts.ts'

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

/**
 * Rota de convidado: aguarda a sessão; se autenticado, redireciona.
 *
 * Exceção: quando o usuário chegou com intenção de retomar uma compra iniciada
 * como visitante (`resumeAction: 'purchase-draft'`) e existe um rascunho válido,
 * vai para o formulário em vez do Dashboard. Fazer isso AQUI (e não no Login)
 * evita a corrida entre o redirect deste guard e o `navigate` pós-login.
 */
export function RequireGuest({ children }: RequireGuestProps) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <SessionLoading />
  }

  if (status === 'authenticated') {
    const wantsResume =
      (location.state as { resumeAction?: string } | null)?.resumeAction ===
      'purchase-draft'
    if (wantsResume && hasGuestPurchaseDraft()) {
      return (
        <Navigate
          to="/purchases/new"
          replace
          state={{ resumeAction: 'purchase-draft' }}
        />
      )
    }
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
