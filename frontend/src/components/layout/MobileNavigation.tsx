import { BOTTOM_NAV_ITEMS, type NavItem } from './navigation.ts'

interface MobileNavigationProps {
  activeId?: string
}

export function MobileNavigation({ activeId = 'dashboard' }: MobileNavigationProps) {
  return (
    <nav
      aria-label="Navegação mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-sm md:hidden"
    >
      <ul className="flex h-16 items-center justify-around px-2">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <li key={item.id} className="flex-1">
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
  return (
    <button
      type="button"
      className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
        isActive
          ? 'text-emerald-600 font-semibold'
          : 'text-slate-500 hover:text-slate-900'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
      <span className="truncate">{item.label}</span>
    </button>
  )
}
