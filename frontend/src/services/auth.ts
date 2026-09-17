import {
  login,
  loginWithGoogle,
  register,
  getMe,
  logout as logoutRequest,
  getStoredAccessToken,
  clearStoredAccessToken,
  AuthenticationError,
  ApiError,
} from '../lib/api.ts'
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  RegisterCredentials,
  RegisterResponse,
} from '../types/auth.ts'

/** Erro de autenticação já traduzido para exibição amigável no formulário. */
export class LoginFormError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LoginFormError'
  }
}

/** Erro de cadastro já traduzido para exibição amigável no formulário. */
export class RegisterFormError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegisterFormError'
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

/**
 * Traduz os erros de POST /auth/google em mensagens amigáveis, sem expor
 * detalhes internos da API. Os códigos específicos do login com Google são
 * tratados individualmente; o restante cai nas mensagens genéricas.
 */
function toGoogleFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Não foi possível conectar ao servidor. Tente novamente.'
    }
    switch (error.code) {
      case 'GOOGLE_TOKEN_INVALID':
        return 'Não foi possível validar sua conta Google. Tente novamente.'
      case 'GOOGLE_EMAIL_NOT_VERIFIED':
        return 'Seu email do Google precisa ser verificado antes de continuar.'
      case 'GOOGLE_ACCOUNT_LINK_REQUIRED':
        return 'Já existe uma conta com este email. Entre com sua senha para vincular o Google.'
      case 'GOOGLE_AUTH_NOT_CONFIGURED':
        return 'Login com Google indisponível no momento. Use seu email e senha.'
      default:
        break
    }
    if (error.status >= 500) {
      return 'O servidor está indisponível no momento. Tente novamente mais tarde.'
    }
    return 'Não foi possível entrar com o Google. Tente novamente.'
  }
  return 'Não foi possível entrar com o Google. Tente novamente.'
}

/**
 * Autentica usando a credencial do Google Identity Services via POST /auth/google.
 * Reutiliza o mesmo formato de sucesso do login tradicional (access token já
 * persistido) e o mesmo tipo de erro já exibido no formulário.
 * A credencial é enviada apenas nesta requisição e nunca é armazenada.
 */
export async function authenticateWithGoogle(credential: string): Promise<LoginResponse> {
  try {
    return await loginWithGoogle(credential)
  } catch (error) {
    throw new LoginFormError(toGoogleFriendlyMessage(error))
  }
}

/**
 * Mapeia erros de POST /auth/register para mensagens amigáveis, usando os
 * códigos reais do backend (EMAIL_ALREADY_REGISTERED) sem expor detalhes internos.
 */
function toRegisterFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Não foi possível conectar ao servidor. Tente novamente.'
    }
    if (error.code === 'EMAIL_ALREADY_REGISTERED' || error.status === 409) {
      return 'Este email já está cadastrado.'
    }
    if (error.status === 400) {
      return 'Verifique os dados informados.'
    }
    if (error.status >= 500) {
      return 'O servidor está indisponível no momento. Tente novamente mais tarde.'
    }
    return 'Não foi possível criar a conta. Tente novamente.'
  }
  return 'Não foi possível criar a conta. Tente novamente.'
}

/** Cria a conta via POST /auth/register (não inicia sessão nem retorna token). */
export async function registerUser(
  credentials: RegisterCredentials,
): Promise<RegisterResponse> {
  try {
    return await register(credentials)
  } catch (error) {
    throw new RegisterFormError(toRegisterFriendlyMessage(error))
  }
}

/** Verifica se existe um access token armazenado (não valida no backend). */
export function hasStoredSession(): boolean {
  return Boolean(getStoredAccessToken())
}

/**
 * Busca o usuário autenticado em GET /auth/me.
 * Em caso de 401 limpa o access token e retorna null (sem expor erro ao usuário).
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    return await getMe()
  } catch (error) {
    if (error instanceof AuthenticationError) {
      clearStoredAccessToken()
      return null
    }
    throw error
  }
}

/**
 * Encerra a sessão: notifica o backend (POST /auth/logout) e, mesmo em caso de
 * falha de rede, limpa o access token localmente. O cookie de refresh HttpOnly
 * é removido pelo backend — nunca é tocado pelo JavaScript.
 */
export async function logout(): Promise<void> {
  try {
    await logoutRequest()
  } catch {
    // Falha de rede no logout não deve prender o usuário na área autenticada.
  } finally {
    clearStoredAccessToken()
  }
}
