// Testes de preservação do rascunho no fluxo de cadastro: o draft iniciado em
// guest deve sobreviver a guest → /register → cadastro → /login.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from '../contexts/auth-context.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import {
  getGuestPurchaseDraft,
  saveGuestPurchaseDraft,
} from '../services/guest-drafts.ts'
import type { PurchaseFormFields } from '../components/purchases/purchase-form.ts'
import { registerUser } from '../services/auth.ts'
import { Register } from './Register.tsx'

vi.mock('../services/auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth.ts')>()
  return { ...actual, registerUser: vi.fn() }
})

const mockRegister = vi.mocked(registerUser)

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

function LoginProbe() {
  const location = useLocation()
  const state = location.state as { resumeAction?: string } | null
  return (
    <div>
      <span>LOGIN_PAGE</span>
      <span data-testid="resume">{state?.resumeAction ?? ''}</span>
    </div>
  )
}

function renderRegister(state: { resumeAction?: string } | undefined) {
  const user = userEvent.setup()
  const utils = render(
    <AuthContext.Provider value={makeAuthValue('guest')}>
      <MemoryRouter initialEntries={[{ pathname: '/register', state }]}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { user, ...utils }
}

async function fillRegister(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nome'), 'Ada Lovelace')
  await user.type(screen.getByLabelText('Email'), 'ada@example.com')
  await user.type(screen.getByLabelText('Senha'), 'supersecret')
  await user.type(screen.getByLabelText('Confirmar senha'), 'supersecret')
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))
}

describe('Register — sobrevivência do rascunho', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockRegister.mockResolvedValue(undefined as never)
  })

  it('o rascunho permanece disponível após o cadastro', async () => {
    saveGuestPurchaseDraft(FIELDS)
    const { user } = renderRegister({ resumeAction: 'purchase-draft' })

    await fillRegister(user)

    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument(), {
      timeout: 3000,
    })
    // O rascunho continua intacto depois de guest → register → login.
    expect(getGuestPurchaseDraft()?.data).toEqual(FIELDS)
  })

  it('propaga resumeAction para o login após o cadastro', async () => {
    saveGuestPurchaseDraft(FIELDS)
    const { user } = renderRegister({ resumeAction: 'purchase-draft' })

    await fillRegister(user)

    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument(), {
      timeout: 3000,
    })
    expect(screen.getByTestId('resume')).toHaveTextContent('purchase-draft')
  })

  it('sem resumeAction não propaga intenção de retomada', async () => {
    const { user } = renderRegister(undefined)

    await fillRegister(user)

    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument(), {
      timeout: 3000,
    })
    expect(screen.getByTestId('resume')).toHaveTextContent('')
  })
})
