export function PurchaseDetailsSkeleton() {
  return (
    <div
      className="space-y-6 sm:space-y-8 animate-pulse"
      aria-busy="true"
      aria-label="Carregando detalhes da compra"
    >
      {/* Header Skeleton */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-200" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-slate-200" />
      </section>

      {/* Card do produto Skeleton */}
      <section className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-slate-200" />
          <div className="space-y-2">
            <div className="h-5 w-52 rounded bg-slate-200" />
            <div className="h-3.5 w-32 rounded bg-slate-200" />
          </div>
        </div>
      </section>

      {/* Grade de detalhes Skeleton */}
      <section className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="mt-5 grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-4 w-32 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
