/**
 * Carregamento do Google Identity Services (GIS) — etapa preparatória.
 *
 * Nesta etapa NÃO há autenticação: apenas garantimos que o script
 * `https://accounts.google.com/gsi/client` seja carregado uma única vez e que
 * exista um lugar definido para inicializar o cliente quando o login com Google
 * for implementado. Nenhuma chamada a `/auth/google` é feita aqui.
 */

const GIS_SCRIPT_ID = 'google-identity-services'
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/** Client ID público (Vite expõe apenas variáveis com prefixo `VITE_`). */
export const googleClientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** Indica se o Client ID foi configurado no ambiente do frontend. */
export const hasGoogleClientId = (): boolean => googleClientId.trim().length > 0

/** Subconjunto da API do GIS usado nesta etapa (evita depender do tipos globais). */
interface GoogleIdentityApi {
  accounts?: {
    id?: {
      initialize: (config: {
        client_id: string
        callback: (response: unknown) => void
      }) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentityApi
  }
}

function findExistingScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(`script#${GIS_SCRIPT_ID}`)
}

/**
 * Carrega o script do Google Identity Services uma única vez.
 * Resolve `false` (sem lançar erro) quando o Client ID não está configurado ou
 * quando o script não pode ser carregado — o botão continua apenas visual e o
 * login por email/senha não é afetado.
 */
export function loadGoogleIdentityServices(): Promise<boolean> {
  if (!hasGoogleClientId()) return Promise.resolve(false)

  if (typeof window !== 'undefined' && window.google?.accounts?.id) {
    return Promise.resolve(true)
  }

  const existing = findExistingScript()
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve(true)
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(true), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
    })
  }

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.id = GIS_SCRIPT_ID
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true'
        resolve(true)
      },
      { once: true },
    )
    script.addEventListener('error', () => resolve(false), { once: true })
    document.head.appendChild(script)
  })
}

/**
 * Inicializa o cliente do GIS. Fica pronta para a próxima etapa (o `callback`
 * receberá a credencial/ID token a ser enviado ao backend em `/auth/google`),
 * mas nesta etapa nada é chamado — nenhuma requisição é disparada.
 */
export function initializeGoogleIdentity(
  onCredential: (response: unknown) => void,
): boolean {
  const identity = window.google?.accounts?.id
  if (!hasGoogleClientId() || !identity) return false

  identity.initialize({ client_id: googleClientId, callback: onCredential })
  return true
}
