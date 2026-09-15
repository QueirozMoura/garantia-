export function AlertsSkeleton() {
  return (
    <div
      className="space-y-8 sm:space-y-10 animate-pulse"
      aria-busy="true"
      aria-label="Carregando seus alertas"
    >
      <section className="rounded-[2rem] border border-slate-800 bg-slate-900 p-7 sm:p-9">
        <div className="space-y-3">
          <div className="h-4 w-36 rounded-full bg-slate-700" />
          <div className="h-10 w-52 rounded-lg bg-slate-700" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-700" />
        </div>
      </section>

      <section aria-label="Carregando alertas" className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex justify-between gap-3">
                  <div className="h-5 w-52 max-w-full rounded bg-slate-200" />
                  <div className="h-6 w-32 rounded-full bg-slate-200" />
                </div>
                <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
              </div>
            </div>
            <div className="mt-5 h-16 rounded-2xl bg-slate-100" />
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              {[...Array(3)].map((__, itemIndex) => (
                <div key={itemIndex} className="space-y-2">
                  <div className="h-3 w-28 rounded bg-slate-100" />
                  <div className="h-4 w-24 rounded bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <div className="h-9 w-28 rounded-xl bg-slate-200" />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
