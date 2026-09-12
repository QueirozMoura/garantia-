import { ShieldCheck } from 'lucide-react'
import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM, type NavItem } from './navigation.ts'

interface SidebarProps {
  activeId?: string
}

export function Sidebar({ activeId = 'dashboard' }: SidebarProps) {
  return (
    <aside
      aria-label="Navegação principal"
      className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 bg-white"
    >
      {/* Brand / Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex items-baseline">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Garantia
          </span>
          <span className="text-lg font-bold text-emerald-600">+</span>
        </div>
      </div>

      {/* Main navigation list */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Menu
        </p>
        <ul className="space-y-1">
          {MAIN_NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <NavItemButton item={item} isActive={item.id === activeId} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer / Settings */}
      <div className="border-t border-slate-100 p-3">
        <NavItemButton
          item={SETTINGS_NAV_ITEM}
          isActive={SETTINGS_NAV_ITEM.id === activeId}
        />
      </div>
    </aside>
  )
}

interface NavItemButtonProps {
  item: NavItem
  isActive?: boolean
}

function NavItemButton({ item, isActive }: NavItemButtonProps) {
  const Icon = item.icon
  return (
    <button
      type="button"
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 font-semibold'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon
        className={`h-5 w-5 shrink-0 transition-colors ${
          isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'
        }`}
      />
      <span className="truncate">{item.label}</span>
    </button>
  )
}
