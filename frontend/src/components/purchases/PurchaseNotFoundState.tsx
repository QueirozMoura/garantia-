import { SearchX, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Estado para 404 (PURCHASE_NOT_FOUND) ou 403 (compra de outro usuário). */
export function PurchaseNotFoundState() {
  return (
    <div className="rounded-2xl border-slate-200 bg-white p-8 text-center sm:p-12 shadow-xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
        Compra não encontrada
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Não encontramos esta compra. Ela pode ter sido removida ou o endereço está
        incorreto.
      </p>

      <div className="mt-6 flex justify-center">
        <Link
          to="/purchases"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar para compras</span>
        </Link>
      </div>
    </div>
  )
}
