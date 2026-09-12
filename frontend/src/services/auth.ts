import {
  login,
  getStoredAccessToken,
  clearStoredAccessToken,
  AuthenticationError,
  ApiError,
} from '../lib/api.ts'
import type { LoginCredentials, LoginResponse } from '../types/auth.ts'

/** Erro de autenticação já traduzido para exibição amigável no formulário. */
export class LoginFormError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LoginFormError'
  }
}

/**
 * Mapeia erros da camada de API para mensagens exibíveis ao usuário,
 * sem expor stack traces ou detalhes internos do backend.
 */
function toFriendlyMessage(error: unknown): string {
  if (error instanceof AuthenticationError) {
    return 'Email ou senha inválidos.'
  }
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Não foi possível conectar ao servidor. Tente novamente.'
    }
    if (error.status === 400) {
      return 'Preencha o email e a senha corretamente.'
    }
    if (error.status === 401) {
      return 'Email ou senha inválidos.'
    }
    if (error.status >= 500) {
      return 'O servidor está indisponível no momento. Tente novamente mais tarde.'
    }
    return 'Não foi possível entrar. Tente novamente.'
  }
  return 'Não foi possível entrar. Tente novamente.'
}

/** Autentica o usuário e retorna a resposta (access token já persistido). */
export async function authenticate(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  try {
    return await login(credentials)
  } catch (error) {
    throw new LoginFormError(toFriendlyMessage(error))
  }
}

/** Verifica se existe um access token para considerar o usuário autenticado. */
export function isAuthenticated(): boolean {
  return Boolean(getStoredAccessToken())
}

/** Encerra a sessão local removendo o access token. */
export function logout(): void {
  clearStoredAccessToken()
}
