import {
  LayoutDashboard,
  ShoppingBag,
  ShieldCheck,
  FileText,
  Bell,
  Settings,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'compras', label: 'Minhas compras', icon: ShoppingBag },
  { id: 'garantias', label: 'Garantias', icon: ShieldCheck },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'alertas', label: 'Alertas', icon: Bell },
]

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'compras', label: 'Compras', icon: ShoppingBag },
  { id: 'garantias', label: 'Garantias', icon: ShieldCheck },
  { id: 'documentos', label: 'Documentos', icon: FileText },
]

export const SETTINGS_NAV_ITEM: NavItem = {
  id: 'configuracoes',
  label: 'Configurações',
  icon: Settings,
}
