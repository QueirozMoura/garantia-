import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react'
import { BrandLogo } from '../components/brand/BrandLogo.tsx'
import { authenticate, LoginFormError } from '../services/auth.ts'
import { useAuth } from '../contexts/auth-context.ts'

interface LocationState {
  from?: { pathname?: string }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const redirectTo =
    (location.state as LocationState | null)?.from?.pathname ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>(
    {},
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {}
    if (!email.trim()) {
      errors.email = 'Informe seu email.'
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Informe um email válido.'
    }
    if (!password) {
      errors.password = 'Informe sua senha.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) return

    setIsSubmitting(true)
    try {
      const { user } = await authenticate({ email: email.trim(), password })
      setUser(user)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      const message =
        error instanceof LoginFormError
          ? error.message
          : 'Não foi possível entrar. Tente novamente.'
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 antialiased sm:px-6">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="mb-8 flex-col items-center text-center">
          <BrandLogo size="lg" orientation="vertical" className="w-full" />
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Acesse sua conta para acompanhar compras, garantias e documentos em um só
            lugar.
          </p>
        </div>

        {/* Card do formulário */}
        <div className="rounded-2xl border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={`w-full rounded-lg border bg-white py-2.5 pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                    fieldErrors.email
                      ? 'border-red-300 focus-visible:border-red-400'
                      : 'border-slate-300 focus-visible:border-emerald-500'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Senha */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Senha
                </label>
                <a
                  href="#"
                  onClick={(event) => event.preventDefault()}
                  className="rounded text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••"
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={`w-full rounded-lg border bg-white py-2.5 pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                    fieldErrors.password
                      ? 'border-red-300 focus-visible:border-red-400'
                      : 'border-slate-300 focus-visible:border-emerald-500'
                  }`}
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Entrando...</span>
                </>
              ) : (
                <span>Entrar</span>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Ainda não tem uma conta?{' '}
          <Link
            to="/register"
            className="rounded font-medium text-emerald-700 transition-colors hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Criar conta
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-slate-400">
          Garantia+ · Seu controle de compras e garantias
        </p>
      </div>
    </div>
  )
}
