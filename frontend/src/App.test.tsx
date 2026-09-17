// Testes de roteamento do acesso progressivo.
//
// Garantem que o visitante alcança as cinco páginas de exploração SEM cair no
// /login, e que as rotas verdadeiramente protegidas seguem exigindo sessão.
//
// O módulo de API é mockado para garantir determinismo e provar que nenhuma
// chamada privada ocorre em guest (as funções ficam como spies).
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthContext } from './contexts/auth-context.ts'
import { makeAuthValue } from './test/auth-test-utils.tsx'
import {
  getDashboard,
  getPurchases,
  getWarranties,
  getDocuments,
  getAlerts,
} from './lib/api.ts'

vi.mock('./lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api.ts')>()
  return {
    ...actual,
    getDashboard: vi.fn(),
    getPurchases: vi.fn(),
    getWarranties: vi.fn(),
    getDocuments: vi.fn(),
    getAlerts: vi.fn(),
  }
})

const privateFetchers = [
  getDashboard,
  getPurchases,
  getWarranties,
  getDocuments,
  getAlerts,
]

function renderApp(entry: string, status: 'guest' | 'authenticated' | 'loading') {
  return render(
    <AuthContext.Provider value={makeAuthValue(status)}>
      <MemoryRouter initialEntries={[entry]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Rotas — acesso progressivo (guest)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const explorationRoutes: Array<{ path: string; heading: string | RegExp }> = [
    { path: '/dashboard', heading: /Organize suas compras/ },
    { path: '/purchases', heading: 'Suas compras ficam organizadas aqui.' },
    { path: '/warranties', heading: 'Suas garantias ficam aqui.' },
    { path: '/documents', heading: 'Seus documentos ficam aqui' },
    { path: '/alerts', heading: 'Seus alertas aparecem aqui.' },
  ]

  it.each(explorationRoutes)(
    'guest acessa $path e vê o estado de visitante (não vai para /login)',
    ({ path, heading }) => {
      renderApp(path, 'guest')

      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    },
  )

  it('guest não dispara nenhuma chamada privada ao entrar em /dashboard', () => {
    renderApp('/dashboard', 'guest')

    for (const fetcher of privateFetchers) {
      expect(fetcher).not.toHaveBeenCalled()
    }
  })
})

describe('Rotas protegidas — exigem autenticação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guest em /purchases/:id é levado ao login (sem render dos detalhes)', () => {
    renderApp('/purchases/purchase-42', 'guest')

    expect(
      screen.queryByRole('heading', { name: 'Detalhes da compra' }),
    ).not.toBeInTheDocument()
    // Tela de autenticação renderizada pelo RequireAuth -> Login.
    expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument()
  })

  it('guest acessa /purchases/new como formulário (draft local), sem ir ao login', () => {
    renderApp('/purchases/new', 'guest')

    // Etapa 3: a criação agora é acessível para guest (rascunho local).
    expect(screen.getByRole('heading', { name: 'Adicionar compra' })).toBeInTheDocument()
    expect(
      screen.getByText(/Sua compra será salva depois que você entrar/),
    ).toBeInTheDocument()
  })

  it('guest em /purchases/new/confirm é levado ao login (segue protegida)', () => {
    renderApp('/purchases/new/confirm', 'guest')

    expect(screen.getByRole('heading', { name: /entrar/i })).toBeInTheDocument()
  })
})
