import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
import { BrandLogo } from '../brand/BrandLogo.tsx'
import { useAuth } from '../../contexts/auth-context.ts'

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
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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
      navigate('/login', { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      {/* Left: Mobile brand / Desktop page title context */}
      <div className="flex items-center gap-3">
        {/* Mobile brand (hidden on md+) */}
        <BrandLogo size="sm" className="md:hidden" />

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
        {/* Notificações: recurso ainda não implementado. Visível, porém NÃO
            interativo (sem ação falsa). */}
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Notificações (em breve)"
          title="Notificações em breve"
          className="relative flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg border-slate-200 text-slate-300"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-slate-300 ring-2 ring-white" />
        </button>

        {/* User avatar + menu */}
        <div ref={menuRef} className="relative pl-2 sm:border-l sm:border-slate-200">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label="Abrir menu do usuário"
            className="flex cursor-pointer items-center gap-3 rounded-lg pr-1 transition-colors hover:bg-slate-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white ring-2 ring-slate-100">
              {initial}
            </div>
            <div className="hidden text-left text-xs lg:block">
              <p className="font-medium text-slate-900 leading-tight">{name}</p>
              <p className="text-slate-500 leading-tight">{email}</p>
            </div>
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              aria-label="Menu do usuário"
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border-slate-200 bg-white shadow-lg"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                <p className="truncate text-xs text-slate-500">{email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{isLoggingOut ? 'Saindo…' : 'Sair'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
