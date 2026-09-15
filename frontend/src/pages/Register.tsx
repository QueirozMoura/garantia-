import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/brand/BrandLogo.tsx'
import { User, Mail, Lock, ShieldCheck, FileText, Bell } from 'lucide-react'
import { registerUser, RegisterFormError } from '../services/auth.ts'
import { Button, Input, FeedbackMessage } from '../components/ui'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Regra real do backend (registerSchema): password com no mínimo 8 caracteres.
const PASSWORD_MIN_LENGTH = 8

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

interface RegisterLocationState {
  resumeAction?: string
}

export function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  // Preserva a intenção de retomada (ex.: rascunho de compra de visitante)
  // ao longo de register → login, para não perder o fluxo iniciado em guest.
  const resumeState = (location.state as RegisterLocationState | null) ?? null
  const loginLinkState = resumeState?.resumeAction
    ? { resumeAction: resumeState.resumeAction }
    : undefined

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  function validate(): boolean {
    const errors: FieldErrors = {}

    if (!name.trim()) {
      errors.name = 'Informe seu nome.'
    }

    if (!email.trim()) {
      errors.email = 'Informe seu email.'
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Informe um email válido.'
    }

    if (!password) {
      errors.password = 'Informe uma senha.'
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      errors.password = `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirme sua senha.'
    } else if (confirmPassword !== password) {
      errors.confirmPassword = 'As senhas não coincidem.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (isSubmitting) return
    if (!validate()) return

    setIsSubmitting(true)
    try {
      // POST /auth/register não retorna access token nem inicia sessão.
      await registerUser({ name: name.trim(), email: email.trim(), password })
      // Limpa a senha do estado assim que o cadastro é concluído.
      setPassword('')
      setConfirmPassword('')
      setIsSuccess(true)
      // Confirmação breve antes de seguir para o login (preservando a intenção
      // de retomada, se houver).
      window.setTimeout(() => {
        navigate('/login', { replace: true, state: loginLinkState })
      }, 1500)
    } catch (error) {
      const message =
        error instanceof RegisterFormError
          ? error.message
          : 'Não foi possível criar a conta. Tente novamente.'
      setFormError(message)
      setIsSubmitting(false)
    }
  }

  const passwordLength = password.length
  let strengthPercent = 0
  let strengthColor = 'bg-slate-200'

  if (passwordLength > 0 && passwordLength <= 3) {
    strengthPercent = 33
    strengthColor = 'bg-red-500'
  } else if (passwordLength > 3 && passwordLength <= 7) {
    strengthPercent = 66
    strengthColor = 'bg-amber-500'
  } else if (passwordLength >= 8) {
    strengthPercent = 100
    strengthColor = 'bg-emerald-500'
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
            Comece a proteger suas compras
          </h1>
          <p className="mt-4 text-emerald-100 text-lg max-w-md">
            Crie sua conta para começar a acompanhar compras, garantias e documentos em um
            só lugar.
          </p>
        </div>

        <div className="relative z-10 space-y-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800/50">
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Proteção e Segurança</h3>
              <p className="text-sm text-emerald-200">
                Seus dados e notas fiscais criptografados.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800/50">
              <FileText className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Digitalização Rápida</h3>
              <p className="text-sm text-emerald-200">
                Registre garantias com poucos cliques.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800/50">
              <Bell className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Notificações Inteligentes</h3>
              <p className="text-sm text-emerald-200">Fique por dentro dos prazos.</p>
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
              <h2 className="text-xl font-bold text-slate-900">Criar conta</h2>
              <p className="mt-1 text-sm text-slate-500 lg:hidden">
                Junte-se a nós em menos de 1 minuto.
              </p>
            </div>

            {isSuccess ? (
              <FeedbackMessage
                variant="success"
                title="Conta criada com sucesso!"
                description="Redirecionando para o login..."
              />
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {formError && <FeedbackMessage variant="error" description={formError} />}

                <Input
                  label="Nome"
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  leftIcon={<User className="h-4 w-4" />}
                  error={fieldErrors.name}
                />

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
                  <Input
                    label="Senha"
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    leftIcon={<Lock className="h-4 w-4" />}
                    error={fieldErrors.password}
                  />
                  {passwordLength > 0 && (
                    <div className="pt-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-slate-500">
                          Força da senha
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${strengthColor}`}
                          style={{ width: `${strengthPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Input
                  label="Confirmar senha"
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  leftIcon={<Lock className="h-4 w-4" />}
                  error={fieldErrors.confirmPassword}
                />

                <div className="pt-3">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    isLoading={isSubmitting}
                  >
                    Criar conta
                  </Button>
                </div>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Já possui uma conta?{' '}
            <Link
              to="/login"
              state={loginLinkState}
              className="font-medium text-emerald-600 transition-colors hover:text-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 rounded-sm"
            >
              Entrar
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
