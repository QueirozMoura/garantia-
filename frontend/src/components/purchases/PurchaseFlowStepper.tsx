import { Check } from 'lucide-react'

/**
 * Etapas do fluxo "Adicionar compra" COM nota fiscal. O fluxo manual (sem nota)
 * não usa este indicador — ele continua sendo um único formulário.
 */
export type PurchaseFlowStep = 'form' | 'upload' | 'review' | 'confirm'

const STEPS: { id: PurchaseFlowStep; label: string }[] = [
  { id: 'form', label: 'Compra' },
  { id: 'upload', label: 'Nota fiscal' },
  { id: 'review', label: 'Revisão' },
  { id: 'confirm', label: 'Confirmação' },
]

export interface PurchaseFlowStepperProps {
  /** Etapa atual, destacada visualmente. */
  current: PurchaseFlowStep
  /** Rótulo acessível do conjunto de etapas. */
  ariaLabel?: string
}

/**
 * Indicador de progresso simples para o fluxo com nota fiscal. Responsivo:
 * mostra os rótulos a partir de 375px e, abaixo disso, apenas as bolinhas
 * numeradas — evitando overflow horizontal em telas de 320px.
 */
export function PurchaseFlowStepper({
  current,
  ariaLabel = 'Progresso do cadastro da compra',
}: PurchaseFlowStepperProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === current)

  return (
    <nav
      aria-label={ariaLabel}
      className="rounded-2xl border border-emerald-100 bg-white/85 p-4 shadow-[0_8px_30px_-24px_rgb(16_185_129/0.45)] sm:p-5"
    >
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((step, index) => {
          const isCurrent = step.id === current
          const isDone = currentIndex > -1 && index < currentIndex
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isCurrent
                      ? 'bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-100'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span
                  className={`hidden min-w-0 truncate text-xs font-medium min-[375px]:block sm:text-sm ${
                    isCurrent ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="h-px min-w-2 flex-1 bg-slate-200 sm:min-w-4"
                />
              )}
            </li>
          )
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {currentIndex > -1
          ? `Etapa ${currentIndex + 1} de ${STEPS.length}: ${STEPS[currentIndex].label}`
          : null}
      </p>
    </nav>
  )
}
