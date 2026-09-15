import { NavLink } from 'react-router-dom'
import { BrandLogo } from '../brand/BrandLogo.tsx'
import { MAIN_NAV_ITEMS, SETTINGS_NAV_ITEM, type NavItem } from './navigation.ts'

interface SidebarProps {
  activeId?: string
}

export function Sidebar({ activeId = 'dashboard' }: SidebarProps) {
  return (
    <aside
      aria-label="Navegação principal"
      className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200/80 bg-white/90 shadow-[8px_0_30px_-24px_rgb(15_23_42/0.35)] backdrop-blur-xl"
    >
      {/* Brand / Logo */}
      <div className="flex h-20 items-center border-b border-slate-100 px-5">
        <BrandLogo size="md" />
      </div>

      {/* Main navigation list */}
      <nav className="flex-1 overflow-y-auto px-3 py-7">
        <p className="px-3 pb-3 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">
          Visão geral
        </p>
        <ul className="space-y-0.5">
          {MAIN_NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <NavItemButton item={item} isActive={item.id === activeId} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer / Settings */}
      <div className="border-t border-slate-100 bg-slate-50/60 p-3">
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

  // Itens sem rota ainda não possuem página: mantêm a aparência do menu, mas
  // ficam claramente NÃO interativos (sem navegação falsa).
  if (!item.path) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Em breve"
        className="group flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300"
      >
        <Icon className="h-4.5 w-4.5 shrink-0 text-slate-200" />
        <span className="truncate">{item.label}</span>
      </button>
    )
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive: routeActive }) => {
        const active = routeActive || isActive
        return [
          'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ease-out',
          active
            ? 'bg-emerald-50/90 font-semibold text-emerald-700 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.08)]'
            : 'font-medium text-slate-600 hover:translate-x-0.5 hover:bg-slate-50 hover:text-slate-900',
        ].join(' ')
      }}
    >
      {({ isActive: routeActive }) => {
        const active = routeActive || isActive
        return (
          <>
            {/* Active indicator bar */}
            {active && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-emerald-600"
              />
            )}
            <Icon
              className={[
                'h-4.5 w-4.5 shrink-0 transition-all duration-200',
                active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600',
              ].join(' ')}
            />
            <span className="truncate">{item.label}</span>
          </>
        )
      }}
    </NavLink>
  )
}
