import { ArrowUpRight, FileCode2, FileUp } from 'lucide-react'

export interface DashboardImportCardProps {
  onImportXml: () => void
}

export function DashboardImportCard({ onImportXml }: DashboardImportCardProps) {
  return (
    <div className="group relative isolate overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_16px_38px_-32px_rgb(15_23_42/0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_20px_42px_-30px_rgb(16_185_129/0.28)] sm:p-7">
      <div className="surface-grid absolute inset-0 -z-10 opacity-40 [mask-image:linear-gradient(110deg,black,transparent_72%)]" />
      <div className="absolute -right-10 -top-10 -z-10 h-36 w-36 rounded-full bg-emerald-50 transition-transform duration-300 group-hover:scale-110" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_10px_18px_-12px_rgb(5_150_105/0.8)] transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105">
            <FileCode2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-emerald-700 uppercase">
              Atalho inteligente
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">
              Importe uma NF-e
            </h3>
            <p className="mt-2 max-w-md text-sm leading-5 text-slate-500">
              Cadastre suas compras automaticamente a partir do XML da nota fiscal.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onImportXml}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98]"
        >
          <FileUp className="h-4 w-4" aria-hidden="true" />
          Importar arquivo
          <ArrowUpRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  )
}
