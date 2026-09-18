import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, ChevronDown } from 'lucide-react'
import { BrandLogo } from '../brand/BrandLogo.tsx'
import { useAuth } from '../../contexts/auth-context.ts'
import { isGuestAccessiblePath } from '../auth/guest-routes.ts'
import { Button } from '../ui/Button.tsx'

interface HeaderProps {
  pageTitle?: string
  pageSubtitle?: string
}

/** Primeira letra do nome do usuário para o avatar (fallback ao email). */
function getInitial(name: string, email: string): string {
  const source = name.trim() || email.trim()
  return source.charAt(0).toUpperCase() || '?'
}

export function Header({ pageTitle = 'Dashboard', pageSubtitle }: HeaderProps) {
  const { user, isGuest, isLoading, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const name = user?.name ?? ''
  const email = user?.email ?? ''
  const initial = getInitial(name, email)

  // Fecha o menu ao clicar fora ou pressionar Esc.
  useEffect(() => {
    if (!isMenuOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logout()
      setIsMenuOpen(false)
      // Destino do logout: se a rota atual é visitável por guest, permanecemos
      // nela e a página re-renderiza em estado visitante (o AuthContext já
      // zerou o usuário). Em rotas privadas, vamos ao login preservando a
      // intenção de retorno via `from`.
      if (!isGuestAccessiblePath(location.pathname)) {
        const loginState = { from: location }
        navigate('/login', { replace: true, state: loginState })
      }
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      {/* Left: Mobile brand / Desktop page title context */}
      <div className="flex items-center gap-3">
        {/* Mobile brand (hidden on md+) */}
        <BrandLogo size="sm" className="md:hidden" />

        {/* Desktop title / context */}
        <div className="hidden md:block">
          <p className="text-[10px] font-bold tracking-[0.18em] text-emerald-600 uppercase">
            Garantia+
          </p>
          <h1 className="mt-0.5 text-sm font-semibold text-slate-900">{pageTitle}</h1>
          {pageSubtitle && <p className="text-xs text-slate-500">{pageSubtitle}</p>}
        </div>
      </div>

      {/* Right: Actions & User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notificações: recurso ainda não implementado. */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Notificações (em breve)"
          title="Notificações em breve"
          className="relative flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg text-slate-400"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />

        {/* User avatar + menu.
            Durante o loading não mostramos NENHUM estado de usuário — evita
            exibir um avatar/visitante incorreto antes da verificação terminar. */}
        {isLoading ? null : isGuest ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-semibold text-slate-500 sm:inline">
              Modo visitante
            </span>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-2 text-xs"
              onClick={() => navigate('/login')}
            >
              Entrar
            </Button>
          </div>
        ) : (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="Abrir menu do usuário"
              className="flex cursor-pointer items-center gap-2 rounded-xl p-1.5 transition-all duration-200 hover:bg-slate-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2"
            >
              {/* Avatar */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-xs font-bold text-white ring-2 ring-white shadow-sm">
                {initial}
              </div>
              <div className="hidden text-left text-xs lg:block">
                <p className="font-semibold text-slate-900 leading-tight">
                  {name || email}
                </p>
                {name && (
                  <p className="text-slate-500 leading-tight truncate max-w-[120px]">
                    {email}
                  </p>
                )}
              </div>
              <ChevronDown
                className={[
                  'hidden h-3.5 w-3.5 text-slate-400 transition-transform duration-150 lg:block',
                  isMenuOpen ? 'rotate-180' : '',
                ].join(' ')}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown menu */}
            {isMenuOpen && (
              <div
                role="menu"
                aria-label="Menu do usuário"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-scale-in"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                  <p className="truncate text-xs text-slate-500">{email}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>{isLoggingOut ? 'Saindo…' : 'Sair'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
