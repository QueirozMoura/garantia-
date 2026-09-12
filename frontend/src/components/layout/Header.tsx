import { Bell, ShieldCheck } from 'lucide-react'

interface HeaderProps {
  pageTitle?: string
  pageSubtitle?: string
}

export function Header({ pageTitle = 'Dashboard', pageSubtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      {/* Left: Mobile brand / Desktop page title context */}
      <div className="flex items-center gap-3">
        {/* Mobile brand (hidden on md+) */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            Garantia<span className="text-emerald-600">+</span>
          </span>
        </div>

        {/* Desktop title / context */}
        <div className="hidden md:block">
          <h1 className="text-sm font-semibold tracking-wide text-slate-900">
            {pageTitle}
          </h1>
          {pageSubtitle && <p className="text-xs text-slate-500">{pageSubtitle}</p>}
        </div>
      </div>

      {/* Right: Actions & User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notification bell placeholder */}
        <button
          type="button"
          aria-label="Notificações"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
        </button>

        {/* User avatar / placeholder */}
        <div
          className="flex items-center gap-3 pl-2 sm:border-l sm:border-slate-200"
          aria-label="Perfil do usuário"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white ring-2 ring-slate-100">
            G
          </div>
          <div className="hidden text-left text-xs lg:block">
            <p className="font-medium text-slate-900 leading-tight">Gustavo</p>
            <p className="text-slate-500 leading-tight">gustavo@garantia.plus</p>
          </div>
        </div>
      </div>
    </header>
  )
}
