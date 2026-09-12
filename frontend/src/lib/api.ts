import type { DashboardResponse } from '../types/dashboard.ts'

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

/**
 * Obtém o token de acesso armazenado (ex: localStorage).
 * Não inventa ou cria token fake. Retorna null se não houver.
 */
export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

/**
 * Realiza uma requisição HTTP autenticada quando houver token disponível.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getStoredAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
    })
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique sua conexão.',
      0,
      'NETWORK_ERROR',
    )
  }

  if (response.status === 401) {
    throw new AuthenticationError('Sessão expirada ou não autenticada.')
  }

  if (!response.ok) {
    let errorMessage = `Erro na requisição (${response.status})`
    try {
      const errorJson = await response.json()
      if (errorJson && typeof errorJson.error === 'string') {
        errorMessage = errorJson.error
      } else if (errorJson && typeof errorJson.message === 'string') {
        errorMessage = errorJson.message
      }
    } catch {
      // Ignora erro de parse se resposta não for JSON
    }
    throw new ApiError(errorMessage, response.status)
  }

  return response.json() as Promise<T>
}

/**
 * Busca dados do Dashboard do usuário logado:
 * GET /dashboard
 */
export async function getDashboard(): Promise<DashboardResponse['dashboard']> {
  const data = await request<DashboardResponse>('/dashboard')
  return data.dashboard
}
