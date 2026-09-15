import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, ShoppingBag } from 'lucide-react'

export function WarrantiesEmptyState() {
  const navigate = useNavigate()

  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_44px_-34px_rgb(15_23_42/0.5)] sm:p-14">
      <div className="surface-grid absolute inset-0 -z-10 opacity-35 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="absolute -right-16 -top-20 -z-10 h-48 w-48 rounded-full bg-emerald-50" />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
        Suas garantias ficam aqui
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Cadastre uma garantia na página da compra para acompanhar prazos, proteção e
        próximos vencimentos em um só lugar.
      </p>

      <div className="mt-7 flex justify-center">
        <button
          type="button"
          onClick={() => navigate('/purchases')}
          className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98]"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          <span>Minhas compras</span>
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  )
}
