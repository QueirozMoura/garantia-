import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, ShieldCheck, FileText, Bell } from 'lucide-react'
import { BrandLogo } from '../components/brand/BrandLogo.tsx'
import { GoogleIcon } from '../components/icons/GoogleIcon.tsx'
import { authenticate, authenticateWithGoogle, LoginFormError } from '../services/auth.ts'
import { useAuth } from '../contexts/auth-context.ts'
import { hasGuestPurchaseDraft } from '../services/guest-drafts.ts'
import {
  hasGoogleClientId,
  startGoogleSignIn,
  cancelGoogleSignIn,
  type GoogleCredentialFlow,
} from '../services/google-identity.ts'
import { Button, Input, FeedbackMessage } from '../components/ui'

interface LocationState {
  from?: { pathname?: string }
  resumeAction?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const locationState = location.state as LocationState | null
  // Rota de retorno padrão: `from` quando houver, senão o Dashboard.
  const defaultRedirect = locationState?.from?.pathname ?? '/dashboard'
  // Retomada de compra iniciada como visitante: só redireciona para o
  // formulário quando existe um rascunho válido (o localStorage é a fonte).
  const shouldResumePurchaseDraft =
    locationState?.resumeAction === 'purchase-draft' && hasGuestPurchaseDraft()
  const redirectTo = shouldResumePurchaseDraft ? '/purchases/new' : defaultRedirect

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>(
    {},
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  // Fluxo do GIS já preparado (script + initialize acontecem uma única vez).
  const googleFlowRef = useRef<GoogleCredentialFlow | null>(null)
  // Evita atualizar estado depois que a tela de login for desmontada.
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      cancelGoogleSignIn()
      googleFlowRef.current = null
    }
  }, [])

  /** Redireciona para o destino pós-login, preservando a retomada de rascunho. */
  const goToPostLoginRoute = useCallback(() => {
    if (shouldResumePurchaseDraft) {
      // Retomada: volta ao formulário levando a intenção. O RequireGuest também
      // sabe retomar (cobre o caso em que este navigate perde a corrida).
      navigate('/purchases/new', {
        replace: true,
        state: { resumeAction: 'purchase-draft' },
      })
    } else {
      navigate(redirectTo, { replace: true })
    }
  }, [navigate, redirectTo, shouldResumePurchaseDraft])

  /**
   * Recebe a credencial do Google e conclui o login pelo fluxo normal da API
   * (POST /auth/google). A credencial existe apenas durante a requisição: não é
   * guardada, exibida nem registrada em console.
   */
  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setGoogleError(null)
      try {
        const { user } = await authenticateWithGoogle(credential)
        if (!isMountedRef.current) return
        // Mesmo mecanismo do login por email/senha: atualiza o usuário global.
        setUser(user)
        goToPostLoginRoute()
      } catch (error) {
        if (!isMountedRef.current) return
        const message =
          error instanceof LoginFormError
            ? error.message
            : 'Não foi possível entrar com o Google. Tente novamente.'
        setGoogleError(message)
      } finally {
        if (isMountedRef.current) setIsGoogleLoading(false)
      }
    },
    [goToPostLoginRoute, setUser],
  )

  const handleGoogleUnavailable = useCallback(
    (reason: 'not-configured' | 'script-unavailable' | 'cancelled') => {
      if (!isMountedRef.current) return
      setIsGoogleLoading(false)
      if (reason === 'cancelled') return
      setGoogleError('Login com Google indisponível no momento. Use seu email e senha.')
    },
    [],
  )

  /** Clique no botão: carrega/inicializa o GIS uma única vez e pede a credencial. */
  async function handleGoogleClick() {
    setGoogleError(null)

    if (!hasGoogleClientId()) {
      setGoogleError('Login com Google indisponível no momento. Use seu email e senha.')
      return
    }

    setIsGoogleLoading(true)
    const flow =
      googleFlowRef.current ??
      (await startGoogleSignIn({
        onCredential: handleGoogleCredential,
        onUnavailable: handleGoogleUnavailable,
      }))
    googleFlowRef.current = flow
    if (!isMountedRef.current) return
    if (!flow || !flow.request()) {
      setIsGoogleLoading(false)
      setGoogleError('Login com Google indisponível no momento. Use seu email e senha.')
    }
  }

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
      goToPostLoginRoute()
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
    <div className="flex min-h-screen bg-slate-50 lg:bg-white antialiased">
      {/* Mobile/Tablet Background Tint */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 bg-emerald-100/30 lg:hidden"
        aria-hidden="true"
      />

      {/* Left Panel - Branding (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between bg-gradient-to-br from-emerald-900 to-emerald-700 p-12 text-white overflow-hidden">
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        ></div>

        <div className="relative z-10">
          <BrandLogo
            size="lg"
            orientation="horizontal"
            className="text-white brightness-0 invert"
          />
          <h1 className="mt-8 text-4xl font-bold tracking-tight">
            Seu cofre fiscal e de garantias.
          </h1>
          <p className="mt-4 text-emerald-100 text-lg max-w-md">
            Acesse sua conta para acompanhar compras, garantias e documentos em um só
            lugar.
          </p>
        </div>

        <div className="relative z-10 space-y-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800/50">
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Proteção de garantias</h3>
              <p className="text-sm text-emerald-200">Nunca perca o prazo de troca.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800/50">
              <FileText className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Controle fiscal</h3>
              <p className="text-sm text-emerald-200">
                Notas fiscais organizadas e seguras.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800/50">
              <Bell className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Alertas de vencimento</h3>
              <p className="text-sm text-emerald-200">
                Seja avisado antes que seja tarde.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-10 lg:w-1/2 sm:px-6 animate-fade-in">
        <div className="w-full max-w-md">
          {/* Logo on Mobile */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <BrandLogo size="lg" orientation="vertical" />
          </div>

          {/* Form Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Entrar na sua conta</h2>
              <p className="mt-1 text-sm text-slate-500 lg:hidden">
                Acompanhe suas compras e garantias.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {formError && <FeedbackMessage variant="error" description={formError} />}

              <Input
                label="Email"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                leftIcon={<Mail className="h-4 w-4" />}
                error={fieldErrors.email}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Senha
                  </label>
                  <a
                    href="#"
                    onClick={(event) => event.preventDefault()}
                    className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 rounded-sm"
                  >
                    Esqueci minha senha
                  </a>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  error={fieldErrors.password}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  isLoading={isSubmitting}
                >
                  Entrar
                </Button>
              </div>
            </form>

            {/* Divisor + botão social. O botão inicia o fluxo do Google
                Identity Services; a credencial é enviada uma única vez para
                POST /auth/google e nunca é armazenada. */}
            <div className="mt-5 space-y-5">
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium text-slate-400">ou</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              {googleError && (
                <FeedbackMessage variant="error" description={googleError} />
              )}

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void handleGoogleClick()}
                isLoading={isGoogleLoading}
                leftIcon={<GoogleIcon className="h-4 w-4" />}
              >
                Continuar com Google
              </Button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Ainda não tem uma conta?{' '}
            <Link
              to="/register"
              className="font-medium text-emerald-600 transition-colors hover:text-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 rounded-sm"
            >
              Criar conta
            </Link>
          </p>

          <p className="mt-8 text-center text-xs text-slate-400">
            Garantia+ · Seu controle de compras e garantias
          </p>
        </div>
      </div>
    </div>
  )
}
