import type { ReactNode } from 'react'
import { Sidebar } from '../components/layout/Sidebar.tsx'
import { Header } from '../components/layout/Header.tsx'
import { MobileNavigation } from '../components/layout/MobileNavigation.tsx'
import { GuestModeBanner } from '../components/auth/GuestModeBanner.tsx'
import { useAuth } from '../contexts/auth-context.ts'

interface AppLayoutProps {
  children: ReactNode
  activeNavId?: string
}

export function AppLayout({ children, activeNavId = 'dashboard' }: AppLayoutProps) {
  const { isGuest } = useAuth()

  return (
    <div className="min-h-screen text-slate-900 antialiased">
      {/* Sidebar fixa no Desktop (md+) */}
      <Sidebar activeId={activeNavId} />

      {/* Área principal deslocada da sidebar no Desktop */}
      <div className="flex min-h-screen flex-col md:pl-64">
        <Header />

        {/* Conteúdo da página com margem inferior no mobile para a bottom-bar */}
        <main className="flex-1 px-4 py-6 pb-20 sm:px-6 md:pb-8 lg:px-8">
          <div className="page-enter mx-auto max-w-7xl">
            {isGuest && <GuestModeBanner />}
            {children}
          </div>
        </main>
      </div>

      {/* Navegação inferior fixa no Mobile (md:hidden) */}
      <MobileNavigation activeId={activeNavId} />
    </div>
  )
}
