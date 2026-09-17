import type { Alert, AlertsResponse } from '../types/alert.ts'
import type { DashboardResponse } from '../types/dashboard.ts'
import type {
  CreatePurchaseInput,
  CreatePurchaseResponse,
  Purchase,
  PurchasesResponse,
  UpdatePurchaseInput,
  UpdatePurchaseResponse,
} from '../types/purchase.ts'
import type {
  CreateWarrantyInput,
  UpdateWarrantyInput,
  Warranty,
  WarrantyResponse,
  WarrantyWithPurchase,
  WarrantiesResponse,
} from '../types/warranty.ts'
import type {
  Document,
  DocumentExtraction,
  DocumentExtractionConfirmationResponse,
  DocumentExtractionResponse,
  DocumentResponse,
  DocumentType,
  DocumentWithPurchase,
  DocumentsResponse,
  DocumentsListResponse,
} from '../types/document.ts'
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  RegisterCredentials,
  RegisterResponse,
} from '../types/auth.ts'
import type {
  Assistance,
  AssistanceAnalysis,
  AssistanceAnalysisResponse,
  AssistanceResponse,
} from '../types/assistance.ts'
import type { NfeImportInvoice, NfeImportResponse } from '../types/nfe-import.ts'

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
  /**
   * Uso interno: marca a própria chamada de refresh. Uma requisição marcada não
   * tenta renovar a sessão ao receber 401, evitando recursão/loop infinito.
   */
  isRefreshRequest?: boolean
  /** Uso interno: garante no máximo um retry após um 401. */
  isRetry?: boolean
}

/** Resposta de POST /auth/refresh: apenas um novo access token é retornado. */
interface RefreshResponse {
  accessToken: string
}

/**
 * Promise de refresh em andamento. Enquanto existir, todas as requisições que
 * receberem 401 aguardam ESTA mesma promise, em vez de disparar um novo POST
 * /auth/refresh. Garante um único refresh por expiração (sem corridas).
 */
let refreshPromise: Promise<string> | null = null
/**
 * Renova o access token via POST /auth/refresh usando o cookie HttpOnly.
 *
 * - Não lê nem armazena o refresh token em JavaScript (ele só existe no cookie).
 * - A chamada usa `withCredentials` para enviar o cookie.
 * - É marcada com `isRefreshRequest` para nunca entrar no fluxo de retry, o que
 *   impede a recursão 401 → refresh → 401 → refresh.
 *
 * Falhas de rede/5xx e 401 são propagadas como erro: o chamador trata como
 * sessão expirada e o AuthContext segue o fluxo atual de logout/redirect.
 */
const performRefresh = async (): Promise<string> => {
  const data = await request<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    withCredentials: true,
    isRefreshRequest: true,
  })
  setStoredAccessToken(data.accessToken)
  return data.accessToken
}

/**
 * Compartilha uma única promise de refresh entre chamadas concorrentes.
 * Quando ela resolve ou rejeita, é limpa para permitir um novo refresh caso o
 * token volte a expirar depois.
 */
const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

/**
 * Realiza uma requisição HTTP autenticada quando houver token disponível.
 *
 * Em um 401 numa request autenticada, tenta renovar a sessão UMA vez via
 * /auth/refresh e repete a request original com o novo token. Se a renovação
 * falhar (ou o retry voltar a falhar com 401), propaga o erro de autenticação
 * para que o AuthContext encerre a sessão como já fazia.
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    withCredentials = true,
    isRefreshRequest = false,
    isRetry = false,
    ...init
  } = options
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
      // O próprio refresh nunca se renova: 401 aqui é sessão expirada de fato.
      // Também nunca renovamos numa request que já é o retry (máximo 1 retry).
      if (!isRefreshRequest && !isRetry) {
        try {
          await refreshAccessToken()
        } catch {
          // Refresh falhou (401/5xx/rede): encerra a sessão como antes.
          clearStoredAccessToken()
          throw new AuthenticationError(message)
        }

        // Refresh OK: repete a request original UMA única vez com o novo token.
        // `withCredentials` e os demais campos de `init` são reenviados; o body
        // (string JSON ou FormData) também é reaproveitado sem re-serialização.
        return request<T>(endpoint, {
          ...init,
          withCredentials,
          isRefreshRequest,
          isRetry: true,
        })
      }

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
 * Busca uma compra específica do usuário logado:
 * GET /purchases/:id — responde 200 com `{ purchase }`.
 * 404 (PURCHASE_NOT_FOUND) quando não existe; 403 (PURCHASE_ACCESS_DENIED)
 * quando pertence a outro usuário.
 */
export async function getPurchase(id: string): Promise<Purchase> {
  const data = await request<CreatePurchaseResponse>(
    `/purchases/${encodeURIComponent(id)}`,
  )
  return data.purchase
}

/**
 * Cadastra uma nova compra do usuário logado:
 * POST /purchases — responde 201 com `{ purchase }`.
 */
export async function createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
  const data = await request<CreatePurchaseResponse>('/purchases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.purchase
}

/**
 * Atualiza uma compra do usuário logado:
 * PUT /purchases/:id — responde 200 com `{ purchase }`.
 *
 * Envia somente os campos da compra (sem userId). 404 (PURCHASE_NOT_FOUND)
 * quando não existe; 403 (PURCHASE_ACCESS_DENIED) quando é de outro usuário.
 */
export async function updatePurchase(
  id: string,
  input: UpdatePurchaseInput,
): Promise<Purchase> {
  const data = await request<UpdatePurchaseResponse>(
    `/purchases/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  )
  return data.purchase
}

/**
 * Exclui uma compra do usuário logado:
 * DELETE /purchases/:id — responde 204 sem corpo.
 *
 * Sem body e sem `userId` (a autorização é do backend via token). O `request`
 * já trata 204 sem tentar ler JSON; 404 (PURCHASE_NOT_FOUND), 403
 * (PURCHASE_ACCESS_DENIED) e 400 (PURCHASE_HAS_DEPENDENCIES) viram ApiError.
 */
export async function deletePurchase(id: string): Promise<void> {
  await request<void>(`/purchases/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/**
 * Lista todas as garantias do usuário logado, com os dados básicos da compra
 * relacionada: GET /warranties — responde 200 com `{ warranties }`.
 */
export async function getWarranties(): Promise<WarrantyWithPurchase[]> {
  const data = await request<WarrantiesResponse>('/warranties')
  return data.warranties
}

/**
 * Busca a garantia de uma compra do usuário logado:
 * GET /purchases/:purchaseId/warranty — responde 200 com `{ warranty }`.
 *
 * Ausência de garantia é um estado normal: o backend responde 404 com
 * `code: WARRANTY_NOT_FOUND`, então essa função devolve `null`. Qualquer outro
 * erro (403, 404 de compra, 401, 500, rede) continua sendo propagado.
 */
export async function getPurchaseWarranty(purchaseId: string): Promise<Warranty | null> {
  try {
    const data = await request<WarrantyResponse>(
      `/purchases/${encodeURIComponent(purchaseId)}/warranty`,
    )
    return data.warranty
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === 'WARRANTY_NOT_FOUND'
    ) {
      return null
    }
    throw error
  }
}

/**
 * Cadastra a garantia de uma compra do usuário logado:
 * POST /purchases/:purchaseId/warranty — responde 201 com `{ warranty }`.
 * As datas devem ser strings "YYYY-MM-DD" (enviadas sem conversão de fuso).
 */
export async function createPurchaseWarranty(
  purchaseId: string,
  input: CreateWarrantyInput,
): Promise<Warranty> {
  const data = await request<WarrantyResponse>(
    `/purchases/${encodeURIComponent(purchaseId)}/warranty`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return data.warranty
}

/**
 * Atualiza a garantia de uma compra do usuário logado:
 * PUT /purchases/:purchaseId/warranty — responde 200 com `{ warranty }`.
 *
 * O body é enviado enxuto (apenas os campos editáveis), nunca a `Warranty`
 * inteira, para não mandar `id`/`purchaseId`/timestamps.
 */
export async function updatePurchaseWarranty(
  purchaseId: string,
  input: UpdateWarrantyInput,
): Promise<Warranty> {
  const data = await request<WarrantyResponse>(
    `/purchases/${encodeURIComponent(purchaseId)}/warranty`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  )
  return data.warranty
}

/**
 * Exclui a garantia de uma compra do usuário logado:
 * DELETE /purchases/:purchaseId/warranty — responde 204 sem corpo.
 *
 * Sem body (a garantia é identificada pelo `purchaseId` na rota). O `request`
 * já trata 204 sem tentar ler JSON; 401 (AuthenticationError), 403
 * (PURCHASE_ACCESS_DENIED), 404 (WARRANTY_NOT_FOUND/PURCHASE_NOT_FOUND) e 500
 * viram ApiError para a camada de UI exibir mensagem amigável.
 */
export async function deletePurchaseWarranty(purchaseId: string): Promise<void> {
  await request<void>(`/purchases/${encodeURIComponent(purchaseId)}/warranty`, {
    method: 'DELETE',
  })
}

/**
 * Solicita assistência para uma compra do usuário logado:
 * POST /purchases/:purchaseId/assistance — responde 200 com `{ assistance }`.
 *
 * O endpoint é stateless (não persiste nada): verifica a compra e a situação da
 * garantia e devolve o resultado já pronto — portanto nenhum GET adicional é
 * necessário depois do POST. O `problem` é enviado já normalizado (`trim`); o
 * backend revalida entre 5 e 2000 caracteres. 401 → AuthenticationError,
 * 403 (PURCHASE_ACCESS_DENIED), 404 (PURCHASE_NOT_FOUND), 400
 * (VALIDATION_ERROR) e 500/rede viram ApiError para a UI tratar.
 */
export async function prepareAssistance(
  purchaseId: string,
  problem: string,
): Promise<Assistance> {
  const data = await request<AssistanceResponse>(
    `/purchases/${encodeURIComponent(purchaseId)}/assistance`,
    {
      method: 'POST',
      body: JSON.stringify({ problem }),
    },
  )
  return data.assistance
}

/**
 * Gera a orientação com IA para um problema de assistência:
 * POST /purchases/:purchaseId/assistance/analyze — responde 200 com `{ analysis }`.
 *
 * Chamado somente depois que a preparação (`prepareAssistance`) foi bem-sucedida
 * e usando EXATAMENTE o mesmo `problem`. O backend é stateless e devolve o texto
 * pronto — nenhum GET adicional é feito depois. Segue o mesmo mecanismo de
 * autenticação/erros do restante da API: 401 → AuthenticationError; 400/403/404
 * e 500/rede viram ApiError para a UI exibir mensagem amigável.
 */
export async function analyzeAssistance(
  purchaseId: string,
  problem: string,
): Promise<AssistanceAnalysis> {
  const data = await request<AssistanceAnalysisResponse>(
    `/purchases/${encodeURIComponent(purchaseId)}/assistance/analyze`,
    {
      method: 'POST',
      body: JSON.stringify({ problem }),
    },
  )
  return data.analysis
}

/**
 * Lista os documentos vinculados a uma compra do usuário logado:
 * GET /purchases/:purchaseId/documents — responde 200 com `{ documents }`.
 */
export async function getPurchaseDocuments(purchaseId: string): Promise<Document[]> {
  const data = await request<DocumentsResponse>(
    `/purchases/${encodeURIComponent(purchaseId)}/documents`,
  )
  return data.documents
}

/**
 * Envia um novo documento para uma compra do usuário logado:
 * POST /purchases/:purchaseId/documents — responde 201 com `{ document }`.
 *
 * Usa FormData (`file`, `name`, `type`). O Content-Type NÃO é definido
 * manualmente: o browser gera o boundary de multipart automaticamente.
 */
export async function uploadPurchaseDocument(
  purchaseId: string,
  file: File,
  name: string,
  type: DocumentType,
): Promise<Document> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', name)
  formData.append('type', type)

  const data = await request<DocumentResponse>(
    `/purchases/${encodeURIComponent(purchaseId)}/documents`,
    {
      method: 'POST',
      body: formData,
    },
  )
  return data.document
}

/**
 * Exclui um documento do usuário logado:
 * DELETE /documents/:documentId — responde 204 sem corpo.
 */
/**
 * Lista todos os documentos do usuário logado, das adições mais recentes para
 * as mais antigas, cada um com os dados básicos da compra relacionada:
 * GET /documents — responde 200 com `{ documents }`.
 */
export async function getDocuments(): Promise<DocumentWithPurchase[]> {
  const data = await request<DocumentsListResponse>('/documents')
  return data.documents
}

/**
 * Lista os alertas do usuário logado, derivados de suas garantias, na ordem de
 * urgência definida pelo backend:
 * GET /alerts — responde 200 com `{ alerts }`.
 *
 * As regras de negócio (dias restantes, garantia vencida/vencendo) são do
 * backend; aqui apenas devolvemos os alertas como recebidos.
 */
export async function getAlerts(): Promise<Alert[]> {
  const data = await request<AlertsResponse>('/alerts')
  return data.alerts
}

/**
 * Exclui um documento do usuário logado:
 * DELETE /documents/:documentId — responde 204 sem corpo.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  await request<void>(`/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  })
}

/**
 * Solicita à IA a extração dos dados de uma nota fiscal do usuário logado:
 * POST /documents/:documentId/extract — responde 200 com `{ data }`.
 *
 * Sem body: o documento é identificado pela URL e a autorização/regra de
 * negócio ficam no backend. Retorna apenas o payload útil da extração; erros
 * (401, 403, 404, 400, 503, 502...) seguem o tratamento padrão do `request`.
 */
export async function extractDocument(documentId: string): Promise<DocumentExtraction> {
  const data = await request<DocumentExtractionResponse>(
    `/documents/${encodeURIComponent(documentId)}/extract`,
    { method: 'POST' },
  )
  return data.data
}

/**
 * Confirma a extração de uma nota, aplicando os dados à compra (e à garantia,
 * quando houver `warrantyMonths`):
 * PATCH /documents/:documentId/extraction — responde 200 com `{ purchase, warranty }`.
 *
 * Envia exatamente a extração revisada. A validação, a transação e as regras de
 * garantia/ownership ficam no backend; aqui só enviamos e devolvemos o resultado
 * já atualizado para a tela. Erros (400, 401, 403, 404...) seguem o tratamento
 * padrão do `request`.
 */
export async function confirmDocumentExtraction(
  documentId: string,
  data: DocumentExtraction,
): Promise<DocumentExtractionConfirmationResponse> {
  return request<DocumentExtractionConfirmationResponse>(
    `/documents/${encodeURIComponent(documentId)}/extraction`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        productName: data.productName,
        brand: data.brand,
        model: data.model,
        purchaseDate: data.purchaseDate,
        price: data.price,
        store: data.store,
        warrantyMonths: data.warrantyMonths,
      }),
    },
  )
}

/**
 * Baixa o arquivo de um documento do usuário logado:
 * GET /documents/:documentId — responde o binário com o Content-Type original.
 *
 * A rota é autenticada e privada: o token segue no header Authorization e
 * nunca na URL. O Blob resultante é usado apenas em memória para exibição.
 */
export async function getDocumentFile(documentId: string): Promise<Blob> {
  const url = `${API_URL}/documents/${encodeURIComponent(documentId)}`

  const fetchBlob = async (): Promise<Response> => {
    const headers = new Headers()
    const token = getStoredAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    try {
      return await fetch(url, { headers, credentials: 'include' })
    } catch {
      throw new ApiError(
        'Não foi possível conectar ao servidor. Tente novamente.',
        0,
        'NETWORK_ERROR',
      )
    }
  }

  let response = await fetchBlob()

  // Mesmo fluxo de refresh do `request()`: em 401, renova UMA vez (compartilhando
  // a promise de refresh) e reenvia o download com o novo token.
  if (response.status === 401) {
    try {
      await refreshAccessToken()
    } catch {
      clearStoredAccessToken()
      throw new AuthenticationError()
    }
    response = await fetchBlob()
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new AuthenticationError()
    }
    throw new ApiError(`Erro na requisição (${response.status})`, response.status)
  }

  return response.blob()
}

/**
 * Envia um XML de NF-e para leitura e extração dos dados:
 * POST /nfe/import — responde 200 com `{ message, invoice }`.
 *
 * Usa FormData com o campo `file` (o Content-Type NÃO é definido manualmente: o
 * browser gera o boundary de multipart). O endpoint é autenticado e passa pelo
 * mecanismo de refresh automático do `request`. Nesta etapa nada é persistido:
 * nenhuma compra/garantia é criada. Erros (400 com código específico, 401, 500)
 * viram ApiError/AuthenticationError para a UI traduzir em mensagem amigável.
 */
export async function importNfeXml(file: File): Promise<NfeImportInvoice> {
  const formData = new FormData()
  formData.append('file', file)

  const data = await request<NfeImportResponse>('/nfe/import', {
    method: 'POST',
    body: formData,
  })
  return data.invoice
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
 * Autentica o usuário com a credencial (ID token) do Google Identity Services.
 * POST /auth/google — mesma base URL, mesmo tratamento de erro e mesma
 * persistência de access token do login por email/senha; o refresh token segue
 * em cookie HttpOnly definido pelo backend.
 */
export async function loginWithGoogle(credential: string): Promise<LoginResponse> {
  const data = await request<LoginResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
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
