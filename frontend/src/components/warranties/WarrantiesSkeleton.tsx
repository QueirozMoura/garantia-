export function WarrantiesSkeleton() {
  return (
    <div
      className="space-y-8 sm:space-y-10 animate-pulse"
      aria-busy="true"
      aria-label="Carregando suas garantias"
    >
      <section className="rounded-[2rem] border border-slate-800 bg-slate-900 p-7 sm:p-9">
        <div className="space-y-3">
          <div className="h-4 w-36 rounded-full bg-slate-700" />
          <div className="h-10 w-64 rounded-lg bg-slate-700" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-700" />
        </div>
      </section>

      <section
        aria-label="Carregando indicadores"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-slate-200" />
              <div className="space-y-2">
                <div className="h-3 w-28 rounded bg-slate-200" />
                <div className="h-8 w-12 rounded bg-slate-200" />
              </div>
            </div>
            <div className="mt-5 h-4 w-40 rounded bg-slate-100" />
          </div>
        ))}
      </section>

      <section aria-label="Carregando lista de garantias" className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex justify-between gap-3">
                  <div className="h-5 w-48 rounded bg-slate-200" />
                  <div className="h-6 w-28 rounded-full bg-slate-200" />
                </div>
                <div className="h-4 w-28 rounded bg-slate-100" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[...Array(4)].map((__, itemIndex) => (
                <div key={itemIndex} className="space-y-2">
                  <div className="h-3 w-16 rounded bg-slate-100" />
                  <div className="h-4 w-24 rounded bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-slate-100 p-4">
              <div className="h-3 w-44 rounded bg-slate-100" />
              <div className="mt-3 h-2 rounded-full bg-slate-200" />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
