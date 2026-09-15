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
      className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200/80 bg-white"
    >
      {/* Brand / Logo */}
      <div className="flex h-16 items-center border-b border-slate-100 px-5">
        <BrandLogo size="md" />
      </div>

      {/* Main navigation list */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-2 pb-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
          Menu
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
          'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ease-out',
          active
            ? 'bg-emerald-50 font-semibold text-emerald-700'
            : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900',
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
                className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-emerald-600"
              />
            )}
            <Icon
              className={[
                'h-4.5 w-4.5 shrink-0 transition-colors duration-150',
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
