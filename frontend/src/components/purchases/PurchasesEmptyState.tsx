import { ShoppingBag, Plus } from 'lucide-react'

export function PurchasesEmptyState() {
  return (
    <div className="rounded-2xl border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <ShoppingBag className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
        Você ainda não possui compras cadastradas
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Cadastre seu primeiro produto para acompanhar prazos de garantia e guardar os
        documentos da compra em um só lugar.
      </p>

      <div className="mt-6 flex justify-center">
        {/* Botão visual: a criação de compras será implementada na próxima etapa. */}
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Adicionar compra</span>
        </button>
      </div>
    </div>
  )
}
