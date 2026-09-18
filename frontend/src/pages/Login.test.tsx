// Testes do fluxo de retomada de rascunho no login.
//
// Com resumeAction === 'purchase-draft' E um rascunho válido, o login leva de
// volta a /purchases/new (para restaurar o formulário). Sem rascunho, mantém o
// comportamento atual (from/dashboard).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { makeAuthValue, TEST_USER } from '../test/auth-test-utils.tsx'
import { saveGuestPurchaseDraft } from '../services/guest-drafts.ts'
import type { PurchaseFormFields } from '../components/purchases/purchase-form.ts'
import { Login } from './Login.tsx'
import {
  authenticate,
  authenticateWithGoogle,
  linkGoogleAccount,
  LoginFormError,
  GOOGLE_ACCOUNT_LINK_REQUIRED_CODE,
  GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE,
} from '../services/auth.ts'
import { startGoogleSignIn } from '../services/google-identity.ts'

vi.mock('../services/auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth.ts')>()
  return {
    ...actual,
    authenticate: vi.fn(),
    authenticateWithGoogle: vi.fn(),
    linkGoogleAccount: vi.fn(),
  }
})

// O GIS é substituído por um dublê: o clique no botão entrega uma credencial
// controlada, permitindo provar o envio para POST /auth/google sem tocar na
// rede nem no script real do Google.
vi.mock('../services/google-identity.ts', () => ({
  hasGoogleClientId: () => true,
  startGoogleSignIn: vi.fn(),
  cancelGoogleSignIn: vi.fn(),
}))

const mockAuthenticate = vi.mocked(authenticate)
const mockAuthenticateWithGoogle = vi.mocked(authenticateWithGoogle)
const mockLinkGoogleAccount = vi.mocked(linkGoogleAccount)
const mockStartGoogleSignIn = vi.mocked(startGoogleSignIn)

/**
 * Credencial que o botão OFICIAL do Google entregará ao ser renderizado no
 * container (`renderButton`). O clique real acontece dentro do botão do Google;
 * nestes testes a entrega é simulada quando o fluxo renderiza o botão.
 */
let deliverCredential: string | null = null
/**
 * Configura `startGoogleSignIn` para devolver um fluxo que, ao renderizar o
 * botão, entrega a credencial informada pelo callback existente. Configurado
 * por padrão em `beforeEach`, para que o efeito de montagem do Login já o use.
 */
function installGoogleFlowMock() {
  mockStartGoogleSignIn.mockImplementation(async (handlers) => ({
    request: () => {
      if (deliverCredential !== null) {
        const credential = deliverCredential
        void Promise.resolve().then(() => handlers.onCredential(credential))
      }
      return true
    },
  }))
}

/** Define a credencial que o botão oficial entregará ao renderizar. */
function stubGoogleCredential(credential: string) {
  deliverCredential = credential
}

/** Aguarda o container do botão oficial do Google ser renderizado na tela. */
const findGoogleButton = () => screen.findByTestId('google-signin-button')

const FIELDS: PurchaseFormFields = {
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  serialNumber: 'SN-12345',
  store: 'Magazine Luiza',
  purchaseDate: '2026-01-15',
  price: '8749.90',
  category: 'Informática',
}

interface RouteState {
  resumeAction?: string
  from?: { pathname?: string }
}

type Entry = string | { pathname: string; state: RouteState }

function renderLogin(
  initialEntries: Entry[],
  authOverrides: Partial<AuthContextValue> = {},
) {
  const user = userEvent.setup()
  const auth: AuthContextValue = makeAuthValue('guest', authOverrides)
  const utils = render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>DASHBOARD_PAGE</div>} />
          <Route path="/purchases/new" element={<div>NEW_PURCHASE_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { user, ...utils }
}

async function submitLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'ada@example.com')
  await user.type(screen.getByLabelText('Senha'), 'supersecret')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

const resumeEntry: Entry = {
  pathname: '/login',
  state: { resumeAction: 'purchase-draft' },
}
const fromNewEntry: Entry = {
  pathname: '/login',
  state: { from: { pathname: '/purchases/new' } },
}

// Todo teste monta o Login (que renderiza o botão oficial no efeito de
// montagem), então o fluxo do GIS precisa estar mockado por padrão.
beforeEach(() => {
  deliverCredential = null
  installGoogleFlowMock()
})

describe('Login — retomada de rascunho', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockAuthenticate.mockResolvedValue({ accessToken: 'token', user: TEST_USER })
  })

  it('com resumeAction e rascunho válido vai para /purchases/new', async () => {
    saveGuestPurchaseDraft(FIELDS)
    const { user } = renderLogin([resumeEntry])

    await submitLogin(user)

    expect(await screen.findByText('NEW_PURCHASE_PAGE')).toBeInTheDocument()
  })

  it('com resumeAction mas SEM rascunho mantém o comportamento padrão', async () => {
    const { user } = renderLogin([resumeEntry])

    await submitLogin(user)

    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
  })

  it('sem resumeAction vai para o destino indicado em from', async () => {
    saveGuestPurchaseDraft(FIELDS)
    const { user } = renderLogin([fromNewEntry])

    await submitLogin(user)

    expect(await screen.findByText('NEW_PURCHASE_PAGE')).toBeInTheDocument()
  })

  it('sem state nenhum, vai para o dashboard', async () => {
    const { user } = renderLogin(['/login'])

    await submitLogin(user)

    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
  })
})

describe('Login — fluxo com Google', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    deliverCredential = null
    installGoogleFlowMock()
    mockAuthenticate.mockResolvedValue({ accessToken: 'token', user: TEST_USER })
    mockAuthenticateWithGoogle.mockResolvedValue({
      accessToken: 'token-google',
      user: TEST_USER,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete window.google
  })

  it('envia a credential recebida do Google e autentica pelo fluxo existente', async () => {
    const CREDENTIAL = 'credencial-do-google'
    stubGoogleCredential(CREDENTIAL)
    const setUser = vi.fn()
    renderLogin(['/login'], { setUser })

    await findGoogleButton()

    await waitFor(() =>
      expect(mockAuthenticateWithGoogle).toHaveBeenCalledWith(CREDENTIAL),
    )
    expect(setUser).toHaveBeenCalledWith(TEST_USER)
    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
    // A credencial nunca é persistida.
    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
  })

  it('sucesso do Google preserva a retomada de rascunho após o login', async () => {
    saveGuestPurchaseDraft(FIELDS)
    stubGoogleCredential('credencial-do-google')
    const setUser = vi.fn()
    renderLogin([resumeEntry], { setUser })

    await findGoogleButton()

    expect(await screen.findByText('NEW_PURCHASE_PAGE')).toBeInTheDocument()
    expect(setUser).toHaveBeenCalledWith(TEST_USER)
  })

  it('erro do Google não autentica o usuário e mostra mensagem amigável', async () => {
    stubGoogleCredential('credencial-invalida')
    mockAuthenticateWithGoogle.mockRejectedValueOnce(
      new LoginFormError(
        'Seu email do Google precisa ser verificado antes de continuar.',
      ),
    )
    const setUser = vi.fn()
    renderLogin(['/login'], { setUser })

    await findGoogleButton()

    expect(
      await screen.findByText(
        'Seu email do Google precisa ser verificado antes de continuar.',
      ),
    ).toBeInTheDocument()
    expect(setUser).not.toHaveBeenCalled()
    expect(screen.queryByText('DASHBOARD_PAGE')).not.toBeInTheDocument()
  })

  it('GOOGLE_ACCOUNT_LINK_REQUIRED mostra a mensagem específica de vinculação', async () => {
    stubGoogleCredential('credencial-de-conta-existente')
    mockAuthenticateWithGoogle.mockRejectedValueOnce(
      new LoginFormError(
        GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE,
        GOOGLE_ACCOUNT_LINK_REQUIRED_CODE,
      ),
    )
    const setUser = vi.fn()
    renderLogin(['/login'], { setUser })

    await findGoogleButton()

    expect(
      await screen.findByText(
        'Já existe uma conta com este email. Entre com sua senha para vincular o Google.',
      ),
    ).toBeInTheDocument()
    expect(setUser).not.toHaveBeenCalled()
    expect(screen.queryByText('DASHBOARD_PAGE')).not.toBeInTheDocument()
  })

  it('login por email/senha continua funcionando', async () => {
    const setUser = vi.fn()
    const { user } = renderLogin(['/login'], { setUser })

    await submitLogin(user)

    expect(mockAuthenticate).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'supersecret',
    })
    expect(setUser).toHaveBeenCalledWith(TEST_USER)
    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
  })
})

describe('Login — credential Google pendente (GOOGLE_ACCOUNT_LINK_REQUIRED)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    deliverCredential = null
    installGoogleFlowMock()
    mockAuthenticate.mockResolvedValue({ accessToken: 'token', user: TEST_USER })
    mockAuthenticateWithGoogle.mockResolvedValue({
      accessToken: 'token-google',
      user: TEST_USER,
    })
    mockLinkGoogleAccount.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete window.google
  })

  /**
   * A credential pendente é um detalhe interno (ref em memória), sem observador
   * externo. Os testes verificam o contrato observável: o fluxo para nesse erro
   * (sem autenticar/navegar), a mensagem correta aparece e a credential não vaza
   * para nenhum armazenamento.
   */
  /**
   * Monta o Login já com a credential pendente configurada, garantindo que o
   * efeito de montagem (que renderiza o botão oficial e entrega a credential)
   * a veja, e aguarda a mensagem de vínculo pendente aparecer.
   */
  async function renderLoginWithLinkRequired(
    credential: string,
    authOverrides: Partial<AuthContextValue> = {},
  ) {
    stubGoogleCredential(credential)
    mockAuthenticateWithGoogle.mockRejectedValueOnce(
      new LoginFormError(
        GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE,
        GOOGLE_ACCOUNT_LINK_REQUIRED_CODE,
      ),
    )
    const utils = renderLogin(['/login'], authOverrides)
    await findGoogleButton()
    await screen.findByText(GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE)
    return utils
  }

  it('mostra a mensagem e PARA o fluxo nesse erro (sem autenticar nem navegar)', async () => {
    const setUser = vi.fn()
    await renderLoginWithLinkRequired('credencial-pendente-1', { setUser })

    expect(setUser).not.toHaveBeenCalled()
    expect(screen.queryByText('DASHBOARD_PAGE')).not.toBeInTheDocument()
    expect(screen.queryByText('NEW_PURCHASE_PAGE')).not.toBeInTheDocument()
  })

  it('não guarda nada do Google em outros erros do Google', async () => {
    stubGoogleCredential('credencial-generica')
    mockAuthenticateWithGoogle.mockRejectedValueOnce(
      new LoginFormError(
        'Seu email do Google precisa ser verificado antes de continuar.',
        'GOOGLE_EMAIL_NOT_VERIFIED',
      ),
    )
    renderLogin(['/login'])

    await findGoogleButton()
    await screen.findByText(
      'Seu email do Google precisa ser verificado antes de continuar.',
    )

    expect(JSON.stringify(localStorage)).not.toContain('credencial-generica')
    expect(JSON.stringify(sessionStorage)).not.toContain('credencial-generica')
    expect(window.location.href).not.toContain('credencial-generica')
  })

  it('mantém a mensagem mas não persiste a credential', async () => {
    const CREDENTIAL = 'credencial-super-secreta'
    await renderLoginWithLinkRequired(CREDENTIAL)

    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
    // E a mensagem não vaza a credencial na tela.
    expect(document.body.textContent).not.toContain(CREDENTIAL)
  })

  it('não deixa rastro da credential após desmontar a página de login', async () => {
    const CREDENTIAL = 'credencial-pendente-desmontar'
    const { unmount } = await renderLoginWithLinkRequired(CREDENTIAL)

    unmount()

    // A tela some; nada da credential permanece em armazenamento/URL/DOM.
    expect(screen.queryByText(GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE)).not.toBeInTheDocument()
    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
  })

  it('reiniciar o fluxo do Google não reaproveita a credential anterior', async () => {
    const CREDENTIAL = 'credencial-pendente-reinicio'
    await renderLoginWithLinkRequired(CREDENTIAL)

    // Um novo fluxo (novo botão oficial) não reaproveita a credential anterior.
    await findGoogleButton()

    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
    expect(document.body.textContent).not.toContain(CREDENTIAL)
  })

  it('login por senha após o erro não persiste a credential pendente', async () => {
    const CREDENTIAL = 'credencial-pendente-senha'
    const { user } = await renderLoginWithLinkRequired(CREDENTIAL)

    await submitLogin(user)

    // O feedback de vínculo (com sucesso) antecede a navegação pós-login.
    expect(
      await screen.findByText('DASHBOARD_PAGE', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
  })

  it('login por senha que falha não persiste a credential pendente', async () => {
    const CREDENTIAL = 'credencial-pendente-senha-falha'
    mockAuthenticate.mockRejectedValueOnce(
      new LoginFormError('Email ou senha inválidos.'),
    )
    const { user } = await renderLoginWithLinkRequired(CREDENTIAL)

    await submitLogin(user)

    expect(await screen.findByText('Email ou senha inválidos.')).toBeInTheDocument()
    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
  })
})
describe('Login — vinculação Google após o login por senha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    mockAuthenticate.mockResolvedValue({ accessToken: 'token', user: TEST_USER })
    mockAuthenticateWithGoogle.mockResolvedValue({
      accessToken: 'token-google',
      user: TEST_USER,
    })
    mockLinkGoogleAccount.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete window.google
    vi.useRealTimers()
  })

  /**
   * Monta o Login com a credential pendente configurada e aguarda o fluxo
   * terminar em GOOGLE_ACCOUNT_LINK_REQUIRED, deixando a credential pendente
   * pronta para o login por senha.
   */
  async function renderLoginWithLinkRequired(
    credential: string,
    authOverrides: Partial<AuthContextValue> = {},
  ) {
    stubGoogleCredential(credential)
    mockAuthenticateWithGoogle.mockRejectedValueOnce(
      new LoginFormError(
        GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE,
        GOOGLE_ACCOUNT_LINK_REQUIRED_CODE,
      ),
    )
    const utils = renderLogin(['/login'], authOverrides)
    await findGoogleButton()
    await screen.findByText(GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE)
    return utils
  }

  const LINKED_MESSAGE = 'Conta Google vinculada com sucesso.'

  it('login normal (sem credential pendente) NÃO chama /auth/google/link', async () => {
    const { user } = renderLogin(['/login'])

    await submitLogin(user)

    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
    expect(mockLinkGoogleAccount).not.toHaveBeenCalled()
  })

  it('login normal NÃO mostra a mensagem de vínculo Google', async () => {
    const { user } = renderLogin(['/login'])

    await submitLogin(user)

    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
    expect(screen.queryByText(LINKED_MESSAGE)).not.toBeInTheDocument()
  })

  it('login por senha com credential pendente envia a credential para vinculação', async () => {
    const CREDENTIAL = 'credencial-para-vincular'
    const { user } = await renderLoginWithLinkRequired(CREDENTIAL)

    await submitLogin(user)

    // A vinculação usa exatamente a credential pendente, depois do login por senha.
    expect(mockLinkGoogleAccount).toHaveBeenCalledTimes(1)
    expect(mockLinkGoogleAccount).toHaveBeenCalledWith(CREDENTIAL)

    // Após o feedback breve, navega normalmente.
    expect(
      await screen.findByText('DASHBOARD_PAGE', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
  })

  it('vinculação com sucesso (204) mostra a mensagem de vínculo', async () => {
    const CREDENTIAL = 'credencial-mostra-mensagem'
    const { user } = await renderLoginWithLinkRequired(CREDENTIAL)

    await submitLogin(user)

    // A mensagem aparece enquanto o usuário ainda está na tela de login.
    expect(await screen.findByText(LINKED_MESSAGE)).toBeInTheDocument()
    // E, após o feedback, a navegação pós-login acontece normalmente.
    expect(
      await screen.findByText('DASHBOARD_PAGE', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
  })

  it('resposta 204 conclui a vinculação e limpa a credential pendente', async () => {
    const CREDENTIAL = 'credencial-limpar-204'
    const { user } = await renderLoginWithLinkRequired(CREDENTIAL)

    await submitLogin(user)

    expect(await screen.findByText(LINKED_MESSAGE)).toBeInTheDocument()
    expect(mockLinkGoogleAccount).toHaveBeenCalledWith(CREDENTIAL)
    // Não persiste a credential em nenhum armazenamento após a vinculação.
    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
  })

  it('falha na vinculação NÃO mostra a mensagem de vínculo', async () => {
    const CREDENTIAL = 'credencial-falha-sem-mensagem'
    mockLinkGoogleAccount.mockRejectedValueOnce(
      new LoginFormError('Não foi possível entrar com o Google. Tente novamente.'),
    )
    const { user } = await renderLoginWithLinkRequired(CREDENTIAL)

    await submitLogin(user)

    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
    expect(screen.queryByText(LINKED_MESSAGE)).not.toBeInTheDocument()
  })

  it('falha na vinculação mantém o usuário autenticado e a navegação pós-login', async () => {
    const CREDENTIAL = 'credencial-falha-vinculo'
    mockLinkGoogleAccount.mockRejectedValueOnce(
      new LoginFormError('Não foi possível entrar com o Google. Tente novamente.'),
    )
    const setUser = vi.fn()
    const { user } = await renderLoginWithLinkRequired(CREDENTIAL, { setUser })

    await submitLogin(user)

    // Login por senha preservado: usuário autenticado e navegação normal.
    expect(setUser).toHaveBeenCalledWith(TEST_USER)
    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
    // Sem mensagem de erro exposta pela falha do vínculo.
    expect(screen.queryByText('Email ou senha inválidos.')).not.toBeInTheDocument()
  })

  it('falha na vinculação NÃO desloga nem limpa a sessão por senha', async () => {
    const CREDENTIAL = 'credencial-sem-logout'
    mockLinkGoogleAccount.mockRejectedValueOnce(new Error('boom'))
    // Reproduz a persistência real de `api.login`: a sessão por senha grava o
    // access token antes de qualquer tentativa de vinculação.
    mockAuthenticate.mockImplementationOnce(async () => {
      localStorage.setItem('access_token', 'token')
      return { accessToken: 'token', user: TEST_USER }
    })
    const { user } = await renderLoginWithLinkRequired(CREDENTIAL)

    await submitLogin(user)

    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
    // O access token do login por senha permanece armazenado após a falha.
    expect(localStorage.getItem('access_token')).toBe('token')
  })

  it('nunca expõe a credential em logs/URL/localStorage/sessionStorage', async () => {
    const CREDENTIAL = 'credencial-nunca-exposta'
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { user } = await renderLoginWithLinkRequired(CREDENTIAL)

    await submitLogin(user)
    await screen.findByText(LINKED_MESSAGE)

    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
    expect(document.body.textContent).not.toContain(CREDENTIAL)
    expect(consoleLog).not.toHaveBeenCalledWith(expect.stringContaining(CREDENTIAL))
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining(CREDENTIAL))

    consoleLog.mockRestore()
    consoleError.mockRestore()
  })
})
