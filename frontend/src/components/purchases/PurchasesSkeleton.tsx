export function PurchasesSkeleton() {
  return (
    <div
      className="space-y-8 sm:space-y-10 animate-pulse"
      aria-busy="true"
      aria-label="Carregando suas compras"
    >
      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 sm:p-9">
        <div className="space-y-3">
          <div className="h-4 w-32 rounded-full bg-slate-200" />
          <div className="h-10 w-60 rounded-lg bg-slate-200" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_11rem_12rem_11rem]">
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
        </div>
      </section>

      <section
        aria-label="Carregando compras"
        className="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        {[...Array(6)].map((_, index) => (
          <div
            key={index}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="flex gap-4">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex justify-between gap-3">
                  <div className="h-5 w-44 rounded bg-slate-200" />
                  <div className="h-4 w-4 rounded bg-slate-200" />
                </div>
                <div className="h-4 w-28 rounded bg-slate-100" />
                <div className="h-3 w-52 rounded bg-slate-100" />
              </div>
            </div>
            <div className="mt-5 flex justify-between border-t border-slate-100 pt-4">
              <div className="space-y-2">
                <div className="h-5 w-24 rounded-full bg-slate-200" />
                <div className="h-4 w-20 rounded-full bg-slate-100" />
              </div>
              <div className="h-6 w-24 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
