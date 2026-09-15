import { NavLink } from 'react-router-dom'
import { BOTTOM_NAV_ITEMS, type NavItem } from './navigation.ts'

interface MobileNavigationProps {
  activeId?: string
}

export function MobileNavigation({ activeId = 'dashboard' }: MobileNavigationProps) {
  return (
    <nav
      aria-label="Navegação mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-sm md:hidden"
    >
      <ul className="flex h-16 items-stretch justify-around px-1">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <li key={item.id} className="flex flex-1">
            <MobileNavItemButton item={item} isActive={item.id === activeId} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

interface MobileNavItemButtonProps {
  item: NavItem
  isActive?: boolean
}

function MobileNavItemButton({ item, isActive }: MobileNavItemButtonProps) {
  const Icon = item.icon

  // Itens sem rota: não interativos.
  if (!item.path) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Em breve"
        className="flex w-full cursor-not-allowed flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium text-slate-300"
      >
        <Icon className="h-5 w-5 text-slate-200" />
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
          'flex w-full flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium transition-colors duration-150',
          active ? 'text-emerald-600' : 'text-slate-500',
        ].join(' ')
      }}
    >
      {({ isActive: routeActive }) => {
        const active = routeActive || isActive
        return (
          <>
            <span
              className={[
                'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150',
                active ? 'bg-emerald-50' : '',
              ].join(' ')}
            >
              <Icon
                className={[
                  'h-5 w-5 transition-all duration-150',
                  active ? 'text-emerald-600 scale-110' : 'text-slate-400',
                ].join(' ')}
              />
            </span>
            <span
              className={['truncate leading-none', active ? 'font-semibold' : ''].join(
                ' ',
              )}
            >
              {item.label}
            </span>
          </>
        )
      }}
    </NavLink>
  )
}
