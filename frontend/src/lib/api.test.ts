// Testes unitários do client de API (src/lib/api.ts).
//
// Cada teste executa o código REAL de api.ts e substitui apenas a camada HTTP
// (fetch). Sem backend, sem internet, sem timers: as respostas são totalmente
// roteirizadas e as chamadas do fetch são registradas na ordem exata em que
// acontecem, permitindo provar o fluxo request -> 401 -> refresh -> retry.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Formato de uma chamada registrada, para inspecionar URL, método, headers,
// body e a ordem das chamadas.
interface RecordedCall {
  url: string
  method: string
  headers: Headers
  body: unknown
  credentials: RequestCredentials | undefined
}

type FetchResponder = (call: RecordedCall, index: number) => Response | Promise<Response>

interface FetchController {
  calls: RecordedCall[]
  /** URLs de cada chamada, na ordem — conveniente para afirmar o fluxo. */
  urls: () => string[]
}

const ACCESS_TOKEN_KEY = 'access_token'

// Constrói um Response JSON do jeito que o client o consome.
const jsonResponse = (status: number, body: unknown): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// Instala um stub de fetch guiado por um array de responders (um por chamada).
// O responder é escolhido pelo índice da chamada; o último é reutilizado se
// houver mais chamadas do que responders.
const installFetch = (responders: FetchResponder[]): FetchController => {
  const calls: RecordedCall[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const call: RecordedCall = {
      url,
      method: (init?.method ?? 'GET').toUpperCase(),
      headers: new Headers(init?.headers),
      body: init?.body,
      credentials: init?.credentials,
    }
    calls.push(call)

    const responder = responders[Math.min(calls.length - 1, responders.length - 1)]
    if (!responder) throw new Error('Nenhum responder de fetch configurado')
    return responder(call, calls.length - 1)
  })

  vi.stubGlobal('fetch', fetchMock)

  return { calls, urls: () => calls.map((call) => call.url) }
}

// Importa uma cópia NOVA de api.ts para que o `refreshPromise` de nível de
// módulo comece limpo em cada teste. Devolve o namespace do módulo.
const importApi = async () => {
  vi.resetModules()
  return import('./api.ts')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

// -------------------------------------------------------------------------
// A) Requisições normais
// -------------------------------------------------------------------------
describe('request normal', () => {
  it('envia Authorization Bearer, método correto e processa o JSON', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-valido')

    const controller = installFetch([
      () => jsonResponse(200, { dashboard: { summary: { totalPurchases: 1 } } }),
    ])

    const result = await api.getDashboard()

    expect(result).toEqual({ summary: { totalPurchases: 1 } })
    expect(controller.calls).toHaveLength(1)

    const [call] = controller.calls
    expect(call.method).toBe('GET')
    expect(call.url).toBe(`${api.API_URL}/dashboard`)
    expect(call.headers.get('Authorization')).toBe('Bearer token-valido')
    expect(call.headers.get('Content-Type')).toBe('application/json')
  })

  it('não envia Authorization quando não há token armazenado', async () => {
    const api = await importApi()

    const controller = installFetch([() => jsonResponse(200, { dashboard: {} })])

    await api.getDashboard()

    const [call] = controller.calls
    expect(call.headers.has('Authorization')).toBe(false)
    // Nunca "Bearer undefined" / "Bearer null".
    expect(call.headers.get('Authorization')).toBeNull()
  })

  it('envia cookies (credentials: include) por padrão', async () => {
    const api = await importApi()

    const controller = installFetch([() => jsonResponse(200, { dashboard: {} })])

    await api.getDashboard()

    expect(controller.calls[0]?.credentials).toBe('include')
  })
})

// -------------------------------------------------------------------------
// B) Erros
// -------------------------------------------------------------------------
describe('erros', () => {
  it('rejeita com ApiError e preserva status/code/message do contrato', async () => {
    const api = await importApi()

    installFetch([
      () =>
        jsonResponse(409, {
          error: {
            message: 'Email is already registered',
            code: 'EMAIL_ALREADY_REGISTERED',
          },
        }),
    ])

    await expect(api.getDashboard()).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
      message: 'Email is already registered',
    })
  })

  it('API retorna 400 → ApiError com status e message do body', async () => {
    const api = await importApi()

    installFetch([
      () =>
        jsonResponse(400, {
          error: { message: 'Validation failed', code: 'VALIDATION_ERROR' },
        }),
    ])

    await expect(
      api.createPurchase({
        productName: '',
        purchaseDate: '2026-09-10',
        price: 0,
        category: 'x',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
    })
  })

  it('rejeita com ApiError de rede (status 0) quando o fetch lança', async () => {
    const api = await importApi()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down')
      }),
    )

    await expect(api.getDashboard()).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })

  it('trata 204 sem tentar ler JSON', async () => {
    const api = await importApi()

    installFetch([() => new Response(null, { status: 204 })])

    await expect(api.deleteDocument('doc-1')).resolves.toBeUndefined()
  })
})

// -------------------------------------------------------------------------
// C) Refresh automático
// -------------------------------------------------------------------------
describe('refresh automático em 401', () => {
  it('ao receber 401, renova via /auth/refresh e repete a request com o novo token', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const controller = installFetch([
      // 1) request original → 401
      () =>
        jsonResponse(401, {
          error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
      // 2) POST /auth/refresh → 200 com novo token
      () => jsonResponse(200, { accessToken: 'token-novo' }),
      // 3) retry da request original → 200
      () => jsonResponse(200, { dashboard: { ok: true } }),
    ])

    const result = await api.getDashboard()

    expect(result).toEqual({ ok: true })
    expect(controller.calls).toHaveLength(3)

    // Ordem exata: original → refresh → retry.
    expect(controller.urls()).toEqual([
      `${api.API_URL}/dashboard`,
      `${api.API_URL}/auth/refresh`,
      `${api.API_URL}/dashboard`,
    ])

    const [original, refresh, retry] = controller.calls
    expect(original.headers.get('Authorization')).toBe('Bearer token-antigo')
    expect(refresh.method).toBe('POST')
    expect(refresh.url).toBe(`${api.API_URL}/auth/refresh`)
    expect(retry.headers.get('Authorization')).toBe('Bearer token-novo')

    // O novo token ficou persistido.
    expect(api.getStoredAccessToken()).toBe('token-novo')
  })

  it('o refresh é enviado com credentials: include (cookie HttpOnly)', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const controller = installFetch([
      () =>
        jsonResponse(401, {
          error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
      () => jsonResponse(200, { accessToken: 'novo' }),
      () => jsonResponse(200, { dashboard: {} }),
    ])

    await api.getDashboard()

    const refresh = controller.calls.find((call) => call.url.endsWith('/auth/refresh'))
    expect(refresh?.credentials).toBe('include')
    // Todas as chamadas (incluindo o refresh) usam cookies.
    expect(controller.calls.map((call) => call.credentials)).toEqual([
      'include',
      'include',
      'include',
    ])
  })

  it('quando o refresh retorna 401, limpa o token e propaga AuthenticationError sem loop', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const controller = installFetch([
      () =>
        jsonResponse(401, {
          error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
      () =>
        jsonResponse(401, {
          error: { message: 'invalid refresh', code: 'INVALID_REFRESH_TOKEN' },
        }),
    ])

    await expect(api.getDashboard()).rejects.toMatchObject({
      name: 'AuthenticationError',
      status: 401,
    })

    // Apenas original + refresh: nenhum retry, nenhum segundo refresh.
    expect(controller.calls).toHaveLength(2)
    expect(controller.urls()).toEqual([
      `${api.API_URL}/dashboard`,
      `${api.API_URL}/auth/refresh`,
    ])
    expect(api.getStoredAccessToken()).toBeNull()
  })

  it('quando o refresh retorna 500, limpa o token e propaga AuthenticationError', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const controller = installFetch([
      () =>
        jsonResponse(401, {
          error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
      () =>
        jsonResponse(500, {
          error: { message: 'Something went wrong', code: 'INTERNAL_ERROR' },
        }),
    ])

    await expect(api.getDashboard()).rejects.toMatchObject({
      name: 'AuthenticationError',
    })

    expect(controller.calls).toHaveLength(2)
    expect(api.getStoredAccessToken()).toBeNull()
  })

  it('quando o refresh falha por erro de rede, limpa o token e propaga AuthenticationError', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1
        if (call === 1) {
          return jsonResponse(401, {
            error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
          })
        }
        throw new TypeError('network down during refresh')
      }),
    )

    await expect(api.getDashboard()).rejects.toMatchObject({
      name: 'AuthenticationError',
    })
    expect(call).toBe(2)
    expect(api.getStoredAccessToken()).toBeNull()
  })
})

// -------------------------------------------------------------------------
// D) Loop de refresh
// -------------------------------------------------------------------------
describe('proteção contra loop de refresh', () => {
  it('retry retornando 401 NÃO dispara um segundo refresh (fluxo termina em erro)', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const controller = installFetch([
      () =>
        jsonResponse(401, {
          error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
      () => jsonResponse(200, { accessToken: 'token-novo' }),
      // retry volta a dar 401 → deve terminar, sem novo refresh
      () =>
        jsonResponse(401, {
          error: { message: 'still expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
    ])

    await expect(api.getDashboard()).rejects.toMatchObject({
      name: 'AuthenticationError',
    })

    expect(controller.calls).toHaveLength(3)
    expect(controller.urls()).toEqual([
      `${api.API_URL}/dashboard`,
      `${api.API_URL}/auth/refresh`,
      `${api.API_URL}/dashboard`,
    ])
    // Exatamente UM refresh em todo o fluxo.
    expect(controller.urls().filter((url) => url.endsWith('/auth/refresh'))).toHaveLength(
      1,
    )
  })
})

// -------------------------------------------------------------------------
// E) Concorrência
// -------------------------------------------------------------------------
describe('refresh compartilhado entre requests concorrentes', () => {
  // Monta um stub de fetch onde as N requests iniciais dão 401, um ÚNICO refresh
  // resolve com um token novo e os retries têm sucesso. O refresh fica "gated":
  // só libera quando todas as requests originais já chamaram 401, garantindo que
  // todas estejam de fato aguardando o mesmo `refreshPromise`.
  const setupConcurrent = (requestCount: number) => {
    let refreshCalls = 0
    let releaseRefresh: (() => void) | undefined
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const originalUrls = new Set<string>()

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      const method = (init?.method ?? 'GET').toUpperCase()
      const auth = new Headers(init?.headers).get('Authorization')

      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1
        await refreshGate
        return jsonResponse(200, { accessToken: 'token-novo' })
      }

      // Requests para o recurso protegido: primeiro 401, depois do refresh 200.
      if (auth === 'Bearer token-novo') {
        if (url.endsWith('/purchases')) return jsonResponse(200, { purchases: [] })
        if (url.endsWith('/alerts')) return jsonResponse(200, { alerts: [] })
        return jsonResponse(200, { dashboard: { ok: true } })
      }
      // Requests originais: precisa aguardar todas antes de liberar o refresh.
      if (method !== 'GET') {
        return jsonResponse(500, { error: { message: 'unexpected', code: 'UNEXPECTED' } })
      }
      originalUrls.add(url)
      if (originalUrls.size >= requestCount) {
        releaseRefresh?.()
      }
      return jsonResponse(401, {
        error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
      })
    })

    vi.stubGlobal('fetch', fetchMock)
    return { refreshCalls: () => refreshCalls }
  }

  it('duas requests simultâneas com 401 compartilham UM único refresh e ambas concluem', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const tracker = setupConcurrent(2)

    const [first, second] = await Promise.all([api.getDashboard(), api.getPurchases()])

    expect(first).toEqual({ ok: true })
    expect(second).toEqual([])
    expect(tracker.refreshCalls()).toBe(1)
    expect(api.getStoredAccessToken()).toBe('token-novo')
  })

  it('três requests simultâneas com 401 também compartilham UM único refresh', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const tracker = setupConcurrent(3)

    const results = await Promise.all([
      api.getDashboard(),
      api.getPurchases(),
      api.getAlerts(),
    ])

    expect(results).toHaveLength(3)
    expect(tracker.refreshCalls()).toBe(1)
    expect(api.getStoredAccessToken()).toBe('token-novo')
  })
})

// -------------------------------------------------------------------------
// F) Requests especiais
// -------------------------------------------------------------------------
describe('requests especiais', () => {
  it('POST JSON envia Content-Type, body serializado, método e Authorization', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-valido')

    const controller = installFetch([() => jsonResponse(201, { purchase: { id: 'p1' } })])

    const input = {
      productName: 'Notebook',
      purchaseDate: '2026-09-10',
      price: 2999.9,
      category: 'Informática',
    }
    const result = await api.createPurchase(input)

    expect(result).toEqual({ id: 'p1' })
    const [call] = controller.calls
    expect(call.method).toBe('POST')
    expect(call.url).toBe(`${api.API_URL}/purchases`)
    expect(call.headers.get('Content-Type')).toBe('application/json')
    expect(call.headers.get('Authorization')).toBe('Bearer token-valido')
    expect(call.body).toBe(JSON.stringify(input))
  })

  it('upload com FormData NÃO define Content-Type manualmente (boundary automático)', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-valido')

    const controller = installFetch([() => jsonResponse(201, { document: { id: 'd1' } })])

    const file = new File(['%PDF-1.4'], 'nota.pdf', { type: 'application/pdf' })
    const result = await api.uploadPurchaseDocument('p1', file, 'Nota fiscal', 'INVOICE')

    expect(result).toEqual({ id: 'd1' })
    const [call] = controller.calls
    expect(call.method).toBe('POST')
    expect(call.url).toBe(`${api.API_URL}/purchases/p1/documents`)
    // O client não deve forçar multipart/form-data: o browser gera o boundary.
    expect(call.headers.has('Content-Type')).toBe(false)
    expect(call.headers.get('Content-Type')).toBeNull()
    expect(call.headers.get('Authorization')).toBe('Bearer token-valido')
    expect(call.body).toBeInstanceOf(FormData)

    const formData = call.body as FormData
    expect(formData.get('name')).toBe('Nota fiscal')
    expect(formData.get('type')).toBe('INVOICE')
    expect(formData.get('file')).toBeInstanceOf(File)
  })

  it('getDocumentFile baixa o arquivo autenticado e retorna o Blob', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-valido')

    const blob = new Blob(['%PDF-1.4 conteudo'], { type: 'application/pdf' })
    const controller = installFetch([() => new Response(blob, { status: 200 })])

    const result = await api.getDocumentFile('doc-1')

    expect(controller.calls).toHaveLength(1)
    const [call] = controller.calls
    expect(call.url).toBe(`${api.API_URL}/documents/doc-1`)
    expect(call.headers.get('Authorization')).toBe('Bearer token-valido')
    expect(call.credentials).toBe('include')
    expect(result).toBeInstanceOf(Blob)
    // jsdom não preserva o mime do Blob do Response; validamos conteúdo não-vazio.
    expect(result.size).toBeGreaterThan(0)
  })

  it('getDocumentFile em 401 renova a sessão e repete o download com o novo token', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    let dashboardsSeen = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      const auth = new Headers(init?.headers).get('Authorization')

      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(200, { accessToken: 'token-novo' })
      }
      if (auth === 'Bearer token-novo') {
        return new Response(new Blob(['conteudo novo']), { status: 200 })
      }
      dashboardsSeen += 1
      return jsonResponse(401, {
        error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.getDocumentFile('doc-1')

    const urls = fetchMock.mock.calls.map((call) => call[0].toString())
    expect(urls).toEqual([
      `${api.API_URL}/documents/doc-1`,
      `${api.API_URL}/auth/refresh`,
      `${api.API_URL}/documents/doc-1`,
    ])
    expect(dashboardsSeen).toBe(1)
    expect(result).toBeInstanceOf(Blob)
    expect(api.getStoredAccessToken()).toBe('token-novo')
  })

  it('getDocumentFile quando o refresh falha lança AuthenticationError e limpa o token', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const controller = installFetch([
      () =>
        jsonResponse(401, {
          error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
      () =>
        jsonResponse(401, {
          error: { message: 'invalid refresh', code: 'INVALID_REFRESH_TOKEN' },
        }),
    ])

    await expect(api.getDocumentFile('doc-1')).rejects.toMatchObject({
      name: 'AuthenticationError',
      status: 401,
    })
    // Um 401 no download + um refresh que falhou: nenhum retry extra.
    expect(controller.calls).toHaveLength(2)
    expect(api.getStoredAccessToken()).toBeNull()
  })

  it('getDocumentFile em 401 repetido no retry lança AuthenticationError sem novo refresh', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const controller = installFetch([
      () =>
        jsonResponse(401, {
          error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
      () => jsonResponse(200, { accessToken: 'token-novo' }),
      () =>
        jsonResponse(401, {
          error: { message: 'still expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
    ])

    await expect(api.getDocumentFile('doc-1')).rejects.toMatchObject({
      name: 'AuthenticationError',
      status: 401,
    })
    expect(controller.calls).toHaveLength(3)
    expect(controller.urls().filter((url) => url.endsWith('/auth/refresh'))).toHaveLength(
      1,
    )
  })
})

// -------------------------------------------------------------------------
// G) O próprio refresh
// -------------------------------------------------------------------------
describe('o endpoint de refresh não entra no fluxo de retry', () => {
  it('refresh retornando 401 não dispara um novo refresh (sem recursão)', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    const controller = installFetch([
      () =>
        jsonResponse(401, {
          error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
      () =>
        jsonResponse(401, {
          error: { message: 'invalid refresh', code: 'INVALID_REFRESH_TOKEN' },
        }),
    ])

    await expect(api.getPurchases()).rejects.toMatchObject({
      name: 'AuthenticationError',
    })

    // Sem recursão: exatamente UM POST /auth/refresh, apesar de o refresh ter 401.
    expect(controller.urls().filter((url) => url.endsWith('/auth/refresh'))).toHaveLength(
      1,
    )
    expect(controller.calls).toHaveLength(2)
  })
})

// -------------------------------------------------------------------------
// H) Token / localStorage
// -------------------------------------------------------------------------
describe('gestão do access token', () => {
  it('login persiste o accessToken retornado', async () => {
    const api = await importApi()

    installFetch([
      () => jsonResponse(200, { user: { id: 'u1' }, accessToken: 'token-login' }),
    ])

    await api.login({ email: 'a@b.com', password: 'segredo' })

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('token-login')
    expect(api.getStoredAccessToken()).toBe('token-login')
  })

  it('loginWithGoogle envia a credencial apenas no corpo e não a armazena', async () => {
    const api = await importApi()
    const CREDENTIAL = 'credencial-secreta-do-google.abc'

    const controller = installFetch([
      () => jsonResponse(200, { user: { id: 'u1' }, accessToken: 'token-google' }),
    ])

    await api.loginWithGoogle(CREDENTIAL)

    expect(controller.calls[0].url).not.toContain(CREDENTIAL)
    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
  })

  it('loginWithGoogle envia { credential } para POST /auth/google e persiste o token', async () => {
    const api = await importApi()

    const controller = installFetch([
      () => jsonResponse(200, { user: { id: 'u1' }, accessToken: 'token-google' }),
    ])

    const response = await api.loginWithGoogle('credencial-do-google')

    expect(response.accessToken).toBe('token-google')
    expect(controller.calls).toHaveLength(1)
    expect(controller.urls()[0]).toBe(`${api.API_URL}/auth/google`)
    expect(controller.calls[0].method).toBe('POST')
    expect(controller.calls[0].body).toBe(
      JSON.stringify({ credential: 'credencial-do-google' }),
    )
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('token-google')
  })

  it('loginWithGoogle propaga o código de erro do backend sem persistir token', async () => {
    const api = await importApi()

    installFetch([
      () =>
        jsonResponse(400, {
          error: { message: 'invalid', code: 'GOOGLE_TOKEN_INVALID' },
        }),
    ])

    await expect(api.loginWithGoogle('credencial-invalida')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'GOOGLE_TOKEN_INVALID',
    })
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull()
  })

  it('clearStoredAccessToken remove o token', async () => {
    const api = await importApi()
    api.setStoredAccessToken('algo')

    api.clearStoredAccessToken()

    expect(api.getStoredAccessToken()).toBeNull()
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull()
  })

  it('encerrar a sessão NÃO apaga o rascunho guest (chave independente)', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')
    // Chave do rascunho guest — pertence ao navegador, não à sessão.
    const DRAFT_KEY = 'garantia_guest_purchase_draft'
    localStorage.setItem(DRAFT_KEY, '{"version":1}')

    api.clearStoredAccessToken()

    expect(api.getStoredAccessToken()).toBeNull()
    expect(localStorage.getItem(DRAFT_KEY)).toBe('{"version":1}')
  })

  it('o retry usa o token renovado gravado em localStorage', async () => {
    const api = await importApi()
    api.setStoredAccessToken('token-antigo')

    installFetch([
      () =>
        jsonResponse(401, {
          error: { message: 'expired', code: 'INVALID_ACCESS_TOKEN' },
        }),
      () => jsonResponse(200, { accessToken: 'token-novo' }),
      () => jsonResponse(200, { dashboard: {} }),
    ])

    await api.getDashboard()

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('token-novo')
  })
})
