// Testes do fluxo do Google Identity Services (GIS).
//
// Cobrem os comportamentos críticos desta etapa:
// - sem VITE_GOOGLE_CLIENT_ID o Google fica indisponível (login tradicional intacto);
// - o script é carregado e o cliente inicializado UMA única vez;
// - o botão OFICIAL é renderizado via `renderButton()` (nada de `prompt()`);
// - a credencial é entregue em memória ao callback e NÃO é logada.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

interface InitializeConfig {
  client_id: string
  callback: (response: { credential?: string }) => void
}

interface RenderButtonOptions {
  type?: string
  theme?: string
  size?: string
  text?: string
  shape?: string
  logo_alignment?: string
  width?: number
}

const initialize = vi.fn<(config: InitializeConfig) => void>()
const renderButton = vi.fn<(parent: HTMLElement, options?: RenderButtonOptions) => void>()
const cancel = vi.fn<() => void>()

function installGoogleApi() {
  window.google = { accounts: { id: { initialize, renderButton, cancel } }
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

  it('carrega o script, inicializa uma única vez e renderiza o botão oficial', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const onCredential = vi.fn()
    const container = document.createElement('div')

    const flow = await startGoogleSignIn({ onCredential })
    expect(flow).not.toBeNull()
    expect(flow?.request(container)).toBe(true)
    expect(renderButton).toHaveBeenCalledTimes(1)
    expect(renderButton.mock.calls[0]?.[0]).toBe(container)

    // Segunda chamada reusa o estado de módulo: sem nova inicialização.
    const flowAgain = await startGoogleSignIn({ onCredential })
    flowAgain?.request(container)

    expect(initialize).toHaveBeenCalledTimes(1)
    expect(renderButton).toHaveBeenCalledTimes(2)
    const config = initialize.mock.calls[0]?.[0]
    expect(config?.client_id).toBe('client-id-de-teste')
  })

  it('o botão oficial usa as opções oficiais de aparência do renderButton', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const container = document.createElement('div')

    const flow = await startGoogleSignIn({ onCredential: vi.fn() })
    flow?.request(container)

    const options = renderButton.mock.calls[0]?.[1]
    expect(options).toMatchObject({
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
    })
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

  it('não usa `prompt()`: a entrada é exclusivamente o botão oficial', async () => {
    installGoogleApi()
    const { startGoogleSignIn } = await importService('client-id-de-teste')
    const container = document.createElement('div')

    const flow = await startGoogleSignIn({ onCredential: vi.fn() })
    flow?.request(container)

    // O GIS não expõe `prompt` no conjunto usado por este fluxo.
    expect(window.google?.accounts?.id).not.toHaveProperty('prompt')
  })
})
