export function AlertsSkeleton() {
  return (
    <div
      className="space-y-4 animate-pulse"
      aria-busy="true"
      aria-label="Carregando seus alertas"
    >
      <section className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-48 max-w-full rounded bg-slate-200" />
                <div className="h-3 w-64 max-w-full rounded bg-slate-200" />
              </div>
              <div className="h-6 w-28 shrink-0 rounded-full bg-slate-200" />
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50/60 px-3.5 py-3">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200" />
              <div className="space-y-2">
                <div className="h-3.5 w-32 rounded bg-slate-200" />
                <div className="h-3 w-20 rounded bg-slate-200" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {[...Array(2)].map((__, j) => (
                <div key={j} className="space-y-2">
                  <div className="h-3 w-24 rounded bg-slate-200" />
                  <div className="h-4 w-20 rounded bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <div className="h-9 w-28 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
