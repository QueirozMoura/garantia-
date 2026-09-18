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
  LoginFormError,
  GOOGLE_ACCOUNT_LINK_REQUIRED_CODE,
  GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE,
} from '../services/auth.ts'
import { startGoogleSignIn } from '../services/google-identity.ts'

vi.mock('../services/auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth.ts')>()
  return { ...actual, authenticate: vi.fn(), authenticateWithGoogle: vi.fn() }
})

// O GIS é substituído por um dublê: o clique no botão entrega uma credencial
// controlada, permitindo provar o envio para POST /auth/google sem tocar na
// rede nem no script real do Google.
vi.mock('../services/google-identity.ts', () => ({
  hasGoogleClientId: () => true,
  startGoogleSignIn: vi.fn(),
  cancelGoogleSignIn: vi.fn(),
  // Adaptação mínima: o Login agora também renderiza o botão oficial (diagnóstico).
  renderGoogleButtonForTest: vi.fn(),
  loadGoogleIdentityServices: vi.fn(() => Promise.resolve(true)),
  initializeGoogleIdentity: vi.fn(),
}))

const mockAuthenticate = vi.mocked(authenticate)
const mockAuthenticateWithGoogle = vi.mocked(authenticateWithGoogle)
const mockStartGoogleSignIn = vi.mocked(startGoogleSignIn)

/** Faz o GIS entregar uma credencial assim que o botão pedir a credencial. */
function stubGoogleCredential(credential: string) {
  mockStartGoogleSignIn.mockResolvedValue({
    request: () => {
      void Promise.resolve().then(() =>
        mockStartGoogleSignIn.mock.calls[0]?.[0].onCredential(credential),
      )
      return true
    },
  })
}

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
    const { user } = renderLogin(['/login'], { setUser })

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }))

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
    const { user } = renderLogin([resumeEntry], { setUser })

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }))

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
    const { user } = renderLogin(['/login'], { setUser })

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }))

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
    const { user } = renderLogin(['/login'], { setUser })

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }))

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

  /**
   * A credential pendente é um detalhe interno (ref em memória), sem observador
   * externo. Os testes verificam o contrato observável: o fluxo para nesse erro
   * (sem autenticar/navegar), a mensagem correta aparece e a credential não vaza
   * para nenhum armazenamento.
   */
  async function triggerLinkRequired(
    user: ReturnType<typeof userEvent.setup>,
    credential: string,
  ) {
    stubGoogleCredential(credential)
    mockAuthenticateWithGoogle.mockRejectedValueOnce(
      new LoginFormError(
        GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE,
        GOOGLE_ACCOUNT_LINK_REQUIRED_CODE,
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }))
    return screen.findByText(GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE)
  }

  it('mostra a mensagem e PARA o fluxo nesse erro (sem autenticar nem navegar)', async () => {
    const setUser = vi.fn()
    const { user } = renderLogin(['/login'], { setUser })

    await triggerLinkRequired(user, 'credencial-pendente-1')

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
    const { user } = renderLogin(['/login'])

    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }))
    await screen.findByText(
      'Seu email do Google precisa ser verificado antes de continuar.',
    )

    expect(JSON.stringify(localStorage)).not.toContain('credencial-generica')
    expect(JSON.stringify(sessionStorage)).not.toContain('credencial-generica')
    expect(window.location.href).not.toContain('credencial-generica')
  })

  it('mantém a mensagem mas não persiste a credential', async () => {
    const CREDENTIAL = 'credencial-super-secreta'
    const { user } = renderLogin(['/login'])

    await triggerLinkRequired(user, CREDENTIAL)

    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
    // E a mensagem não vaza a credencial na tela.
    expect(document.body.textContent).not.toContain(CREDENTIAL)
  })

  it('não deixa rastro da credential após desmontar a página de login', async () => {
    const CREDENTIAL = 'credencial-pendente-desmontar'
    const { user, unmount } = renderLogin(['/login'])

    await triggerLinkRequired(user, CREDENTIAL)

    unmount()

    // A tela some; nada da credential permanece em armazenamento/URL/DOM.
    expect(screen.queryByText(GOOGLE_ACCOUNT_LINK_REQUIRED_MESSAGE)).not.toBeInTheDocument()
    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
  })

  it('reiniciar o fluxo do Google não reaproveita a credential anterior', async () => {
    const CREDENTIAL = 'credencial-pendente-reinicio'
    const { user } = renderLogin(['/login'])

    await triggerLinkRequired(user, CREDENTIAL)

    // Novo clique reinicia o fluxo: nenhum dado antigo vaza para lugar nenhum.
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }))

    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
    expect(document.body.textContent).not.toContain(CREDENTIAL)
  })

  it('login por senha após o erro não persiste a credential pendente', async () => {
    const CREDENTIAL = 'credencial-pendente-senha'
    const { user } = renderLogin(['/login'])

    await triggerLinkRequired(user, CREDENTIAL)

    await submitLogin(user)

    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
    expect(window.location.href).not.toContain(CREDENTIAL)
  })

  it('login por senha que falha não persiste a credential pendente', async () => {
    const CREDENTIAL = 'credencial-pendente-senha-falha'
    mockAuthenticate.mockRejectedValueOnce(
      new LoginFormError('Email ou senha inválidos.'),
    )
    const { user } = renderLogin(['/login'])

    await triggerLinkRequired(user, CREDENTIAL)

    await submitLogin(user)

    expect(await screen.findByText('Email ou senha inválidos.')).toBeInTheDocument()
    expect(JSON.stringify(localStorage)).not.toContain(CREDENTIAL)
    expect(JSON.stringify(sessionStorage)).not.toContain(CREDENTIAL)
  })
})
