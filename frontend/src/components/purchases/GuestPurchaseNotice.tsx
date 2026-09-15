import { FileText, LogIn } from 'lucide-react'

/**
 * Aviso discreto exibido no topo de /purchases/new para visitantes: o
 * formulário é preenchido normalmente, mas só é salvo depois do login.
 * Não bloqueia nada — é só informação.
 */
export function GuestPurchaseNotice() {
  return (
    <aside
      aria-label="Compra em modo visitante"
      className="grid gap-3 rounded-2xl border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 shadow-[0_12px_30px_-24px_rgb(120_53_15/0.45)] sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-amber-700 ring-1 ring-amber-200/80">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="leading-5">
          <span className="font-semibold">Você está no modo visitante.</span> Sua compra
          será salva depois que você entrar ou criar uma conta.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
        <a
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
          Entrar
        </a>
        <a
          href="/register"
          className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Criar conta
        </a>
      </div>
    </aside>
  )
}
