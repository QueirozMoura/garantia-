import { AlertCircle, History, Loader2 } from 'lucide-react'

export interface PurchaseDraftRestoreBannerProps {
  /** Dispara o POST /purchases com os dados restaurados. */
  onContinue: () => void
  /** Descarta o rascunho (com confirmação). */
  onDiscard: () => void
  /** `true` enquanto o POST está em andamento. */
  isSubmitting?: boolean
  /** Erro amigável exibido quando o POST falha (rascunho é preservado). */
  errorMessage?: string | null
}

/**
 * Faixa de confirmação após o login: avisa que há uma compra iniciada como
 * visitante e oferece "Continuar e salvar" (dispara o POST) ou "Descartar".
 * Nada é enviado sem o clique explícito em "Continuar e salvar".
 */
export function PurchaseDraftRestoreBanner({
  onContinue,
  onDiscard,
  isSubmitting = false,
  errorMessage = null,
}: PurchaseDraftRestoreBannerProps) {
  return (
    <section
      role="status"
      aria-label="Compra restaurada"
      className="rounded-2xl border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_12px_30px_-24px_rgb(5_150_105/0.45)] sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-emerald-700 ring-1 ring-emerald-200/80">
          <History className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-emerald-950">Compra restaurada</p>
          <p className="mt-0.5 text-sm leading-5 text-emerald-900/80">
            Encontramos uma compra que você começou como visitante. Confira os dados
            abaixo e escolha como continuar.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="mt-4 flex-col-reverse gap-2.5 pl-12 sm:flex-row sm:justify-end sm:pl-0">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSubmitting}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={isSubmitting}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Salvando compra...</span>
            </>
          ) : (
            <span>Continuar e salvar</span>
          )}
        </button>
      </div>
    </section>
  )
}
