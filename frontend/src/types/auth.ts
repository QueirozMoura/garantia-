export interface AuthUser {
  id: string
  name: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface LoginCredentials {
  email: string
  password: string
}

/** Resposta de POST /auth/login (o refresh token vem em cookie HttpOnly). */
export interface LoginResponse {
  user: AuthUser
  accessToken: string
}
