// Testes do fluxo do Google Identity Services (GIS).
//
// Cobrem os comportamentos críticos desta etapa:
// - sem VITE_GOOGLE_CLIENT_ID o Google fica indisponível (login tradicional intacto);
// - o script é carregado e o cliente inicializado UMA única vez;
// - a credencial é entregue em memória ao callback e NÃO é logada.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

interface InitializeConfig {
  client_id: string
  callback: (response: { credential?: string }) => void
}

interface PromptNotification {
  isNotDisplayed?: () => boolean
  isSkippedMoment?: () => boolean
  isDismissedMoment?: () => boolean
}

const initialize = vi.fn<(config: InitializeConfig) => void>()
const prompt = vi.fn<(listener?: (notification: PromptNotification) => void) => void>()
const cancel = vi.fn<() => void>()
// Adaptação mínima de tipo: o mock agora precisa cobrir `renderButton`.
const renderButton = vi.fn<() => void>()

function installGoogleApi() {
  window.google = { accounts: { id: { initialize, prompt, renderButton, cancel } }
}
}

async function importService(clientId: string) {
  vi.resetModules()
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', clientId)
  return import('./google-identity.ts')
}

describe('google-identity — fluxo do GIS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete window.google
    document
      .querySelectorAll('script#google-identity-services')
      .forEach((s) => s.remove())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete window.google
  })

  it('sem Client ID: reporta indisponível e não inicializa o GIS', async () => {
    const { startGoogleSignIn, hasGoogleClientId } = await importService('')
    const onUnavailable = vi.fn()

    expect(hasGoogleClientId()).toBe(false)
    const flow = await startGoogleSignIn({ onCredential: vi.fn(), onUnavailable })

    expect(flow).toBeNull()
    expect(onUnavailable).toHaveBeenCalledWith('not-configured')
    expect(initialize).not.toHaveBeenCalled()
  })

  it('carrega o script, inicializa uma única vez e pede a credencial', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const onCredential = vi.fn()

    const flow = await startGoogleSignIn({ onCredential })
    expect(flow).not.toBeNull()
    expect(flow?.request()).toBe(true)
    expect(prompt).toHaveBeenCalledTimes(1)

    // Segunda chamada reusa o estado de módulo: sem nova inicialização.
    const flowAgain = await startGoogleSignIn({ onCredential })
    flowAgain?.request()

    expect(initialize).toHaveBeenCalledTimes(1)
    expect(prompt).toHaveBeenCalledTimes(2)
    const config = initialize.mock.calls[0]?.[0]
    expect(config?.client_id).toBe('client-id-de-teste')
  })

  it('entrega a credencial em memória sem imprimi-la no console', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const onCredential = vi.fn()
    const SECRET_CREDENTIAL = 'credencial-secreta-do-google.123'

    await startGoogleSignIn({ onCredential })
    const config = initialize.mock.calls[0]?.[0]
    config?.callback({ credential: SECRET_CREDENTIAL })

    expect(onCredential).toHaveBeenCalledWith(SECRET_CREDENTIAL)
    const logged = JSON.stringify([...consoleInfo.mock.calls, ...consoleLog.mock.calls])
    expect(logged).not.toContain(SECRET_CREDENTIAL)
  })

  it('cancelamento do usuário não entrega credencial e sinaliza cancelamento', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const onCredential = vi.fn()
    const onUnavailable = vi.fn()

    await startGoogleSignIn({ onCredential, onUnavailable })
    initialize.mock.calls[0]?.[0].callback({})

    expect(onCredential).not.toHaveBeenCalled()
    expect(onUnavailable).toHaveBeenCalledWith('cancelled')
  })

  it('prompt notDisplayed encerra o fluxo como não concluído', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const onCredential = vi.fn()
    const onUnavailable = vi.fn()

    const flow = await startGoogleSignIn({ onCredential, onUnavailable })
    flow?.request()

    // Simula a notificação do GIS: o One Tap não foi exibido.
    const listener = prompt.mock.calls[0]?.[0]
    listener?.({ isNotDisplayed: () => true, isSkippedMoment: () => false })

    expect(onUnavailable).toHaveBeenCalledWith('cancelled')
    expect(onCredential).not.toHaveBeenCalled()
  })

  it('prompt skipped encerra o fluxo como não concluído', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const onUnavailable = vi.fn()

    const flow = await startGoogleSignIn({ onCredential: vi.fn(), onUnavailable })
    flow?.request()

    const listener = prompt.mock.calls[0]?.[0]
    listener?.({ isSkippedMoment: () => true })

    expect(onUnavailable).toHaveBeenCalledWith('cancelled')
  })

  it('prompt dismissed encerra o fluxo como não concluído', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const onUnavailable = vi.fn()

    const flow = await startGoogleSignIn({ onCredential: vi.fn(), onUnavailable })
    flow?.request()

    const listener = prompt.mock.calls[0]?.[0]
    listener?.({ isDismissedMoment: () => true })

    expect(onUnavailable).toHaveBeenCalledWith('cancelled')
  })

  it('notificação de prompt exibido (sem dispensa) não encerra o fluxo', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const onUnavailable = vi.fn()

    const flow = await startGoogleSignIn({ onCredential: vi.fn(), onUnavailable })
    flow?.request()

    const listener = prompt.mock.calls[0]?.[0]
    // Momento intermediário (ex.: "display"): nada de não concluído.
    listener?.({})

    expect(onUnavailable).not.toHaveBeenCalled()
  })
})
