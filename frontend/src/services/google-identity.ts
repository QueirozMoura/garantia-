/**
 * Fluxo do Google Identity Services (GIS) no frontend.
 *
 * Escopo desta etapa: carregar o script `https://accounts.google.com/gsi/client`
 * uma única vez, inicializar o cliente uma única vez e entregar a credencial
 * (ID token) recebida do Google para quem chamou. Nenhuma chamada a
 * `/auth/google` é feita aqui e nada é persistido (nem localStorage, nem
 * sessionStorage, nem cookies) — a credencial vive apenas em memória.
 */

const GIS_SCRIPT_ID = 'google-identity-services'
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/** Client ID público (Vite expõe apenas variáveis com prefixo `VITE_`). */
export const googleClientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** Indica se o Client ID foi configurado no ambiente do frontend. */
export const hasGoogleClientId = (): boolean => googleClientId.trim().length > 0
/** Resposta de credencial entregue pelo GIS no callback de `initialize`. */
export interface GoogleCredentialResponse {
  /** ID token (JWT) do Google: NUNCA deve ser logado, salvo ou exibido. */
  credential?: string
  /** Motivo do cancelamento, quando o usuário fecha a janela do Google. */
  error?: string
  [key: string]: unknown
}

/** Subconjunto da API do GIS usado nesta etapa (evita depender dos tipos globais). */
interface GoogleIdentityApi {
  accounts?: {
    id?: {
      initialize: (config: {
        client_id: string
        callback: (response: GoogleCredentialResponse) => void
      }) => void
      prompt: (momentListener?: (notification: GooglePromptNotification) => void) => void
      renderButton: (
        parent: HTMLElement,
        options?: {
          theme?: string
          size?: string
          text?: string
          type?: string
          shape?: string
          logo_alignment?: string
          width?: number
        },
      ) => void
      cancel: () => void
    }
  }
}

export interface GoogleSignInHandlers {
  /** Chamado com a credencial válida do Google (mantida apenas em memória). */
  onCredential: (credential: string) => void
  /** Google indisponível, cancelado pelo usuário ou script bloqueado. */
  onUnavailable?: (reason: GoogleUnavailableReason) => void
}

export type GoogleUnavailableReason =
  'not-configured' | 'script-unavailable' | 'cancelled'

/** Notificação do `prompt()` do GIS (motivos de não exibição/dispensa). */
interface GooglePromptNotification {
  getNotDisplayedReason?: () => string
  getSkippedReason?: () => string
  getDismissedReason?: () => string
  isNotDisplayed?: () => boolean
  isSkippedMoment?: () => boolean
  isDismissedMoment?: () => boolean
}

/**
 * Estado de módulo: garante uma única inicialização do GIS por sessão do SPA.
 * Em StrictMode (ou em remontagens da tela de login) o `initialize` não se
 * repete e o callback mais recente é reusado.
 */
let initializing: Promise<boolean> | null = null
let handlers: GoogleSignInHandlers | null = null
/** Handle do fluxo de credencial (aciona o popup/One Tap do Google). */
export interface GoogleCredentialFlow {
  /** Inicia a solicitação da credencial. `false` = Google indisponível. */
  request: () => boolean
}

/**
 * Registra o handler da credencial e dispara a inicialização única do cliente.
 * Retorna `false` (sem lançar erro) quando o Client ID não está configurado —
 * o login tradicional por email/senha segue funcionando normalmente.
 */
function prepareGoogleSignIn(
  onCredential: (credential: string) => void,
  onUnavailable?: (reason: GoogleUnavailableReason) => void,
): Promise<GoogleCredentialFlow | null> {
  if (!hasGoogleClientId()) {
    onUnavailable?.('not-configured')
    return Promise.resolve(null)
  }

  handlers = { onCredential, onUnavailable }

  if (initializing) return initializing.then(() => createFlow())

  initializing = loadGoogleIdentityServices().then((loaded) => {
    console.log('[Google GIS] load resolved', loaded, !!window.google?.accounts?.id)
    if (!loaded || !initializeGoogleIdentity()) {
      onUnavailable?.('script-unavailable')
      return false
    }
    return true
  })

  return initializing.then(() => createFlow())
}

/**
 * Cria o handle do fluxo de credencial. As referências são resolvidas no
 * momento do clique (e não na montagem), então a instância mais recente do
 * `window.google` é sempre usada — mesmo com StrictMode/remontagens.
 */
function createFlow(): GoogleCredentialFlow | null {
  const getIdentity = () => window.google?.accounts?.id
  console.log('[Google GIS] createFlow', !!getIdentity())
  if (!getIdentity()) return null
  return {
    request: () => {
      const identity = getIdentity()
      if (!identity) {
        handlers?.onUnavailable?.('script-unavailable')
        return false
      }
      console.log('[Google GIS] calling prompt')
      identity.prompt((notification) => {
        console.log(
          '[Google GIS] prompt notification',
          'notDisplayed=',
          notification?.getNotDisplayedReason?.(),
          'skipped=',
          notification?.getSkippedReason?.(),
          'dismissed=',
          notification?.getDismissedReason?.(),
        )
      })
      return true
    },
  }
}

declare global {
  interface Window {
    google?: GoogleIdentityApi
  }
}

/**
 * Callback único registrado no GIS: entrega a credencial para o handler mais
 * recente e ignora cancelamentos (sem vazar o token em logs).
 */
function handleCredentialResponse(response: GoogleCredentialResponse): void {
  const credential = response?.credential
  if (typeof credential !== 'string' || credential.length === 0) {
    handlers?.onUnavailable?.('cancelled')
    return
  }
  handlers?.onCredential(credential)
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
 * Inicializa o cliente do GIS uma única vez, usando sempre o mesmo callback
 * de módulo. O `prompt()` fica sob demanda (`startGoogleSignIn`), para que o
 * One Tap só apareça quando o usuário clicar no botão. Não dispara requisições.
 */
export function initializeGoogleIdentity(): boolean {
  const identity = window.google?.accounts?.id
  if (!hasGoogleClientId() || !identity) return false
  console.log('[Google GIS] before initialize')
  identity.initialize({
    client_id: googleClientId,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  } as Parameters<NonNullable<typeof identity.initialize>>[0])
  // Registra que o GIS já foi inicializado para que `startGoogleSignIn()`
  // reutilize esta inicialização em vez de chamar `initialize()` de novo
  // (o GIS avisa "initialize() is called multiple times").
  if (!initializing) initializing = Promise.resolve(true)
  return true
}

/**
 * Inicia o login com Google: carrega o script (uma vez), inicializa o cliente
 * (uma vez) e pede a credencial. A credencial é entregue em `onCredential`
 * apenas em memória — nenhuma API do Garantia+ é chamada nesta etapa.
 */
export function startGoogleSignIn(
  handlersConfig: GoogleSignInHandlers,
): Promise<GoogleCredentialFlow | null> {
  return prepareGoogleSignIn(handlersConfig.onCredential, handlersConfig.onUnavailable)
}

/** Cancela o prompt do GIS (usado no unmount da tela de login). */
export function cancelGoogleSignIn(): void {
  try {
    window.google?.accounts?.id?.cancel()
  } catch {
    // Ambiente sem o GIS (testes/jsdom) ou estado inválido: nada a fazer.
  }
}

/** Somente para testes: restaura o estado de módulo entre casos. */
export function resetGoogleIdentityForTests(): void {
  initializing = null
  handlers = null
}
