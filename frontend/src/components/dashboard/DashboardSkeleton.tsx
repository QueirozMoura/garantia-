export function DashboardSkeleton() {
  return (
    <div
      className="space-y-6 sm:space-y-8 animate-pulse"
      aria-busy="true"
      aria-label="Carregando dados do dashboard"
    >
      {/* 1. Header do conteúdo Skeleton */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-4 w-72 rounded bg-slate-200" />
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-36 rounded-lg bg-slate-200" />
          <div className="h-9 w-36 rounded-lg bg-slate-200" />
        </div>
      </section>

      {/* 2. Grid de 4 Cards de Resumo Skeleton */}
      <section
        aria-label="Carregando indicadores"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 rounded bg-slate-200" />
              <div className="h-9 w-9 rounded-lg bg-slate-200" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-7 w-20 rounded bg-slate-200" />
              <div className="h-3 w-28 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </section>

      {/* 3. Área Central Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compras recentes Skeleton (2/3) */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="h-5 w-36 rounded bg-slate-200" />
              <div className="mt-2 h-3.5 w-64 rounded bg-slate-200" />
            </div>
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-200" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 rounded bg-slate-200" />
                      <div className="h-3 w-24 rounded bg-slate-200" />
                    </div>
                  </div>
                  <div className="h-4 w-16 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Garantias próximas & Dica Skeleton (1/3) */}
        <section className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="h-5 w-44 rounded bg-slate-200" />
            <div className="space-y-3 pt-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 w-full rounded-lg bg-slate-100" />
              ))}
            </div>
          </div>
          <div className="h-24 w-full rounded-xl bg-slate-100" />
        </section>
      </div>
    </div>
  )
}
