import type { DashboardResponse } from '../types/dashboard.ts'
import type { Purchase, PurchasesResponse } from '../types/purchase.ts'
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  RegisterCredentials,
  RegisterResponse,
} from '../types/auth.ts'

/** Chave de armazenamento do access token. O Dashboard depende desta chave. */
const ACCESS_TOKEN_KEY = 'access_token'

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:3000'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Sessão não autenticada. Faça login para continuar.') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'AuthenticationError'
  }
}

/** Formato de erro retornado pelo backend: { error: { message, code } }. */
interface ApiErrorBody {
  error?: {
    message?: string
    code?: string
  }
}

/**
 * Obtém o token de acesso armazenado.
 * Não inventa ou cria token fake. Retorna null se não houver.
 */
export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** Persiste o access token para as próximas chamadas autenticadas. */
export function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

/** Remove o access token armazenado. */
export function clearStoredAccessToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

interface RequestOptions extends RequestInit {
  /** Envia o cookie HttpOnly de refresh token. Padrão: true. */
  withCredentials?: boolean
}

/**
 * Realiza uma requisição HTTP autenticada quando houver token disponível.
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { withCredentials = true, ...init } = options
  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const headers = new Headers(init.headers || {})

  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getStoredAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers,
      credentials: withCredentials ? 'include' : 'same-origin',
    })
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Tente novamente.',
      0,
      'NETWORK_ERROR',
    )
  }

  if (!response.ok) {
    let message = `Erro na requisição (${response.status})`
    let code: string | undefined
    try {
      const body = (await response.json()) as ApiErrorBody
      if (typeof body?.error?.message === 'string') {
        message = body.error.message
      }
      if (typeof body?.error?.code === 'string') {
        code = body.error.code
      }
    } catch {
      // Resposta sem corpo JSON: mantém a mensagem genérica.
    }

    if (response.status === 401) {
      throw new AuthenticationError(message)
    }
    throw new ApiError(message, response.status, code)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

/**
 * Busca dados do Dashboard do usuário logado:
 * GET /dashboard
 */
export async function getDashboard(): Promise<DashboardResponse['dashboard']> {
  const data = await request<DashboardResponse>('/dashboard')
  return data.dashboard
}

/**
 * Lista as compras do usuário logado, das mais recentes para as mais antigas:
 * GET /purchases — a resposta é `{ purchases }`.
 */
export async function getPurchases(): Promise<Purchase[]> {
  const data = await request<PurchasesResponse>('/purchases')
  return data.purchases
}

/**
 * Autentica o usuário e armazena o access token.
 * POST /auth/login — o refresh token permanece em cookie HttpOnly.
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const data = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
  setStoredAccessToken(data.accessToken)
  return data
}

/**
 * Cria uma nova conta no backend.
 * POST /auth/register — responde 201 `{ user }`, sem access token nem sessão.
 */
export async function register(
  credentials: RegisterCredentials,
): Promise<RegisterResponse> {
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

/**
 * Busca o usuário autenticado a partir do access token:
 * GET /auth/me — a resposta é { user }.
 */
export async function getMe(): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/auth/me')
  return data.user
}

/**
 * Encerra a sessão no backend (limpa o cookie HttpOnly de refresh).
 * POST /auth/logout — responde 204. Não lida com o access token local.
 */
export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' })
}
