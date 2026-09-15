export function DocumentsSkeleton() {
  return (
    <div
      className="space-y-8 sm:space-y-10 animate-pulse"
      aria-busy="true"
      aria-label="Carregando seus documentos"
    >
      <section className="rounded-[2rem] border border-slate-800 bg-slate-900 p-7 sm:p-9">
        <div className="space-y-3">
          <div className="h-4 w-28 rounded-full bg-slate-700" />
          <div className="h-10 w-56 rounded-lg bg-slate-700" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-700" />
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_10rem_11rem_11rem]">
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
        </div>
      </section>

      <section aria-label="Carregando documentos" className="space-y-4">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="flex gap-4">
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex justify-between gap-3">
                  <div className="h-5 w-56 max-w-full rounded bg-slate-200" />
                  <div className="h-4 w-4 rounded bg-slate-100" />
                </div>
                <div className="h-4 w-72 max-w-full rounded bg-slate-100" />
              </div>
            </div>
            <div className="mt-5 h-16 rounded-2xl bg-slate-100" />
            <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <div className="h-9 w-24 rounded-xl bg-slate-100" />
              <div className="h-9 w-28 rounded-xl bg-slate-200" />
              <div className="h-9 w-24 rounded-xl bg-slate-200" />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
