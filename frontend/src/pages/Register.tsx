import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/brand/BrandLogo.tsx'
import { User, Mail, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { registerUser, RegisterFormError } from '../services/auth.ts'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Regra real do backend (registerSchema): password com no mínimo 8 caracteres.
const PASSWORD_MIN_LENGTH = 8

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export function Register() {
  const navigate = useNavigate()

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
      // Confirmação breve antes de seguir para o login.
      window.setTimeout(() => {
        navigate('/login', { replace: true })
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 antialiased sm:px-6">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="mb-8 flex-col items-center text-center">
          <BrandLogo size="lg" orientation="vertical" className="w-full" />
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Crie sua conta para começar a acompanhar compras, garantias e documentos em um
            só lugar.
          </p>
        </div>

        {/* Card do formulário */}
        <div className="rounded-2xl border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          {isSuccess ? (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Conta criada com sucesso! Redirecionando para o login…</span>
            </div>
          ) : (
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

              {/* Nome */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Nome
                </label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Seu nome"
                    aria-invalid={Boolean(fieldErrors.name)}
                    className={`w-full rounded-lg border bg-white py-2.5 pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                      fieldErrors.name
                        ? 'border-red-300 focus-visible:border-red-400'
                        : 'border-slate-300 focus-visible:border-emerald-500'
                    }`}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="mt-1.5 text-xs text-red-600">{fieldErrors.name}</p>
                )}
              </div>

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
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo de 8 caracteres"
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

              {/* Confirmar senha */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repita a senha"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    className={`w-full rounded-lg border bg-white py-2.5 pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                      fieldErrors.confirmPassword
                        ? 'border-red-300 focus-visible:border-red-400'
                        : 'border-slate-300 focus-visible:border-emerald-500'
                    }`}
                  />
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1.5 text-xs text-red-600">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Botão Criar conta */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Criando conta...</span>
                  </>
                ) : (
                  <span>Criar conta</span>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Já possui uma conta?{' '}
          <Link
            to="/login"
            className="rounded font-medium text-emerald-700 transition-colors hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Entrar
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-slate-400">
          Garantia+ · Seu controle de compras e garantias
        </p>
      </div>
    </div>
  )
}
