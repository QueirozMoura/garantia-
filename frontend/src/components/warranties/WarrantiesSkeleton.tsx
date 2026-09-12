export function WarrantiesSkeleton() {
  return (
    <div
      className="space-y-6 sm:space-y-8 animate-pulse"
      aria-busy="true"
      aria-label="Carregando suas garantias"
    >
      {/* Indicadores Skeleton */}
      <section
        aria-label="Carregando indicadores"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 rounded bg-slate-200" />
              <div className="h-9 w-9 rounded-lg bg-slate-200" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-7 w-16 rounded bg-slate-200" />
              <div className="h-3 w-28 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </section>

      {/* Lista Skeleton */}
      <section className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-slate-200" />
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-200" />
                </div>
              </div>
              <div className="h-6 w-24 rounded-full bg-slate-200" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
              {[...Array(3)].map((__, j) => (
                <div key={j} className="space-y-2">
                  <div className="h-3 w-16 rounded bg-slate-200" />
                  <div className="h-4 w-24 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
