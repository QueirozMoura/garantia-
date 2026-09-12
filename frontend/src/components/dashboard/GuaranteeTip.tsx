import { Lightbulb } from 'lucide-react'

export interface GuaranteeTipProps {
  title?: string
  content?: string
}

export function GuaranteeTip({
  title = 'Dica do Garantia+',
  content = 'Guarde suas notas fiscais. Elas podem ser necessárias para acionar a garantia ou solicitar assistência.',
}: GuaranteeTipProps) {
  return (
    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-emerald-50/30 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-emerald-950">{title}</h3>
          <p className="text-xs leading-relaxed text-emerald-900/80">{content}</p>
        </div>
      </div>
    </div>
  )
}
