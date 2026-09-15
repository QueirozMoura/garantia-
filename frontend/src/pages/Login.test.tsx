// Testes do fluxo de retomada de rascunho no login.
//
// Com resumeAction === 'purchase-draft' E um rascunho válido, o login leva de
// volta a /purchases/new (para restaurar o formulário). Sem rascunho, mantém o
// comportamento atual (from/dashboard).
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { makeAuthValue, TEST_USER } from '../test/auth-test-utils.tsx'
import { saveGuestPurchaseDraft } from '../services/guest-drafts.ts'
import type { PurchaseFormFields } from '../components/purchases/purchase-form.ts'
import { Login } from './Login.tsx'
import { authenticate } from '../services/auth.ts'

vi.mock('../services/auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth.ts')>()
  return { ...actual, authenticate: vi.fn() }
})

const mockAuthenticate = vi.mocked(authenticate)

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

function renderLogin(initialEntries: Entry[]) {
  const user = userEvent.setup()
  const auth: AuthContextValue = makeAuthValue('guest')
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
