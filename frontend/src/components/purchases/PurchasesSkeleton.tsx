export function PurchasesSkeleton() {
  return (
    <div
      className="space-y-6 sm:space-y-8 animate-pulse"
      aria-busy="true"
      aria-label="Carregando suas compras"
    >
      {/* Header da página Skeleton */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-52 rounded-lg bg-slate-200" />
          <div className="h-4 w-72 rounded bg-slate-200" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-slate-200" />
      </section>

      {/* Lista Skeleton */}
      <section className="rounded-xl border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="h-5 w-36 rounded bg-slate-200" />
          <div className="mt-2 h-3.5 w-64 rounded bg-slate-200" />
        </div>
        <div className="divide-y divide-slate-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-200" />
                </div>
              </div>
              <div className="h-4 w-20 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
