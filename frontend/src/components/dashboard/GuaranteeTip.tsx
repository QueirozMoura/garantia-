import { ArrowUpRight, Lightbulb } from 'lucide-react'

export interface GuaranteeTipProps {
  title?: string
  content?: string
}

export function GuaranteeTip({
  title = 'Dica do Garantia+',
  content = 'Guarde suas notas fiscais. Elas podem ser necessárias para acionar a garantia ou solicitar assistência.',
}: GuaranteeTipProps) {
  return (
    <div className="relative h-full overflow-hidden rounded-[1.5rem] border border-emerald-200/80 bg-emerald-50/70 p-6 sm:p-7">
      <div
        className="absolute -bottom-16 -right-12 h-40 w-40 rounded-full border border-emerald-200/70"
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-[0_10px_18px_-12px_rgb(5_150_105/0.8)]">
            <Lightbulb className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-[0.16em] text-emerald-700 uppercase">
              Conhecimento útil
            </p>
            <h3 className="text-xl font-semibold tracking-[-0.025em] text-emerald-950">
              {title}
            </h3>
            <p className="pt-1 text-sm leading-6 text-emerald-900/80">{content}</p>
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-xs font-semibold text-emerald-700">
          Proteja seus documentos para o futuro
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
