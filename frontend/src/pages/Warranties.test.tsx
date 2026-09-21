// Testes do modo de acesso progressivo na página de Garantias.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import { MemoryRouter } from 'react-router-dom'
import { getWarranties } from '../lib/api.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import type { WarrantyWithPurchase } from '../types/warranty.ts'
import { Warranties } from './Warranties.tsx'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
const isoDaysFromNow = (days: number) => new Date(NOW + days * DAY).toISOString()

let seq = 0
function makeWarranty(
  overrides: Partial<WarrantyWithPurchase> = {},
  purchase: Partial<WarrantyWithPurchase['purchase']> = {},
): WarrantyWithPurchase {
  seq += 1
  return {
    id: `warranty-${seq}`,
    purchaseId: `purchase-${seq}`,
    durationMonths: 12,
    startDate: isoDaysFromNow(-100),
    endDate: isoDaysFromNow(200),
    createdAt: isoDaysFromNow(-100),
    updatedAt: isoDaysFromNow(-100),
    purchase: {
      id: `purchase-${seq}`,
      productName: `Produto ${seq}`,
      brand: null,
      model: null,
      purchaseDate: isoDaysFromNow(-100),
      category: 'Informática',
      ...purchase,
    },
    ...overrides,
  }
}

/** Datas relativas: ativa (200d), vencendo (10d), expirada (-10d). */
function sampleWarranties(): WarrantyWithPurchase[] {
  return [
    makeWarranty(
      { endDate: isoDaysFromNow(200) },
      { productName: 'Notebook Dell', brand: 'Dell' },
    ),
    makeWarranty(
      { endDate: isoDaysFromNow(10) },
      { productName: 'Máquina Samsung', brand: 'Samsung' },
    ),
    makeWarranty(
      { endDate: isoDaysFromNow(-10) },
      { productName: 'TV LG', brand: 'LG' },
    ),
  ]
}

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return {
    ...actual,
    getWarranties: vi.fn(),
  }
})

const mockGetWarranties = vi.mocked(getWarranties)

function renderPage(
  status: 'guest' | 'authenticated' | 'loading',
  auth: Partial<AuthContextValue> = {},
) {
  const value = makeAuthValue(status, auth)
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/warranties']}>
        <Warranties />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Warranties — modo visitante', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guest NÃO chama getWarranties', async () => {
    renderPage('guest')

    await waitFor(() => expect(mockGetWarranties).not.toHaveBeenCalled())
  })

  it('guest renderiza o estado de visitante com CTAs de autenticação', () => {
    renderPage('guest')

    expect(
      screen.getByRole('heading', { name: 'Suas garantias ficam aqui.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('authenticated continua buscando as garantias', async () => {
    mockGetWarranties.mockResolvedValue([])

    renderPage('authenticated')

    await waitFor(() => expect(mockGetWarranties).toHaveBeenCalledTimes(1))
  })
})

/**
 * Busca, filtro por status, ordenação, limpeza e estados da listagem.
 * Executa o componente REAL; apenas `getWarranties` é mockado.
 */
describe('Warranties — busca, filtros e ordenação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** Renderiza autenticado com uma lista fixa e devolve o user do userEvent. */
  async function renderWithData(warranties: WarrantyWithPurchase[]) {
    mockGetWarranties.mockResolvedValue(warranties)
    renderPage('authenticated')
    await screen.findByRole('searchbox', { name: /buscar/i })
    return userEvent.setup()
  }

  it('busca por nome do produto esconde os demais', async () => {
    const user = await renderWithData(sampleWarranties())

    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'notebook')

    expect(screen.getByText('Notebook Dell')).toBeInTheDocument()
    expect(screen.queryByText('Máquina Samsung')).not.toBeInTheDocument()
    expect(screen.queryByText('TV LG')).not.toBeInTheDocument()
  })

  it('busca por marca', async () => {
    const user = await renderWithData(sampleWarranties())

    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'samsung')

    expect(screen.getByText('Máquina Samsung')).toBeInTheDocument()
    expect(screen.queryByText('Notebook Dell')).not.toBeInTheDocument()
  })

  it('busca por marca considera apenas os campos reais do contrato', async () => {
    // `WarrantyPurchase` expõe somente produto e marca: buscar por um termo que
    // só existiria em `store`/`serialNumber` não encontra nada.
    const user = await renderWithData(sampleWarranties())

    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'loja inexistente')

    expect(screen.queryByText('Notebook Dell')).not.toBeInTheDocument()
    expect(screen.queryByText('Máquina Samsung')).not.toBeInTheDocument()
    expect(screen.queryByText('TV LG')).not.toBeInTheDocument()
  })

  it('filtro por status "Expirada" mostra só a garantia expirada', async () => {
    const user = await renderWithData(sampleWarranties())

    await user.selectOptions(screen.getByRole('combobox', { name: /status/i }), 'expired')

    expect(screen.getByText('TV LG')).toBeInTheDocument()
    expect(screen.queryByText('Notebook Dell')).not.toBeInTheDocument()
    expect(screen.queryByText('Máquina Samsung')).not.toBeInTheDocument()
  })

  it('combinação de busca + status', async () => {
    const user = await renderWithData(sampleWarranties())

    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'samsung')
    await user.selectOptions(screen.getByRole('combobox', { name: /status/i }), 'expiring')

    expect(screen.getByText('Máquina Samsung')).toBeInTheDocument()
    expect(screen.queryByText('TV LG')).not.toBeInTheDocument()
  })

  it('ordenação por vencimento mais distante coloca a mais longa primeiro', async () => {
    const user = await renderWithData(sampleWarranties())

    await user.selectOptions(
      screen.getByRole('combobox', { name: /ordenar/i }),
      'due-latest',
    )

    const list = screen.getByRole('region', { name: 'Lista de garantias' })
    // O título da seção também é um h3; consideramos apenas os nomes de produto.
    const headings = within(list)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
      .filter((text) => text !== 'Suas garantias')
    expect(headings[0]).toBe('Notebook Dell')
  })

  it('limpar filtros restaura a lista completa', async () => {
    const user = await renderWithData(sampleWarranties())

    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'notebook')
    expect(screen.queryByText('TV LG')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /limpar filtros/i }))

    expect(screen.getByText('Notebook Dell')).toBeInTheDocument()
    expect(screen.getByText('Máquina Samsung')).toBeInTheDocument()
    expect(screen.getByText('TV LG')).toBeInTheDocument()
  })

  it('mostra o estado "sem resultados" (não o empty de primeira vez) e permite limpar', async () => {
    const user = await renderWithData(sampleWarranties())

    await user.type(
      screen.getByRole('searchbox', { name: /buscar/i }),
      'produto que não existe',
    )

    expect(
      screen.getByRole('heading', { name: /nenhuma garantia corresponde/i }),
    ).toBeInTheDocument()
    // O empty de primeira utilização não deve aparecer.
    expect(screen.queryByText('Suas garantias ficam aqui')).not.toBeInTheDocument()
    // Há um botão de limpar na toolbar e outro no próprio estado "sem resultados".
    const clearButtons = screen.getAllByRole('button', { name: /limpar filtros/i })
    expect(clearButtons.length).toBeGreaterThanOrEqual(1)

    await user.click(clearButtons[clearButtons.length - 1])

    expect(screen.getByText('Notebook Dell')).toBeInTheDocument()
  })

  it('clicar no card do resumo aplica o filtro de status correspondente', async () => {
    const user = await renderWithData(sampleWarranties())

    await user.click(
      screen.getByRole('button', { name: /filtrar garantias: proteção encerrada/i }),
    )

    expect(screen.getByText('TV LG')).toBeInTheDocument()
    expect(screen.queryByText('Notebook Dell')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /filtrar garantias: proteção encerrada/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicar de novo no card ativo limpa o filtro', async () => {
    const user = await renderWithData(sampleWarranties())
    const card = screen.getByRole('button', {
      name: /filtrar garantias: proteção vigente/i,
    })

    await user.click(card)
    expect(screen.queryByText('TV LG')).not.toBeInTheDocument()

    await user.click(card)
    expect(screen.getByText('TV LG')).toBeInTheDocument()
  })

  it('sem garantias: mostra o estado vazio e não mostra a toolbar', async () => {
    mockGetWarranties.mockResolvedValue([])
    renderPage('authenticated')

    await screen.findByText('Suas garantias ficam aqui')
    expect(screen.queryByRole('searchbox', { name: /buscar/i })).not.toBeInTheDocument()
  })

  it('sem garantias: CTA principal "Adicionar compra" aponta para /purchases/new', async () => {
    mockGetWarranties.mockResolvedValue([])
    renderPage('authenticated')

    const addLink = await screen.findByRole('link', { name: /adicionar compra/i })
    expect(addLink).toHaveAttribute('href', '/purchases/new')
  })

  it('sem garantias: CTA secundário "Ver minhas compras" aponta para /purchases', async () => {
    mockGetWarranties.mockResolvedValue([])
    renderPage('authenticated')

    const viewLink = await screen.findByRole('link', { name: /ver minhas compras/i })
    expect(viewLink).toHaveAttribute('href', '/purchases')
  })

  it('com garantias: o estado vazio NÃO aparece', async () => {
    mockGetWarranties.mockResolvedValue(sampleWarranties())
    renderPage('authenticated')

    await screen.findByText('Notebook Dell')
    expect(screen.queryByText('Suas garantias ficam aqui')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /adicionar compra/i }),
    ).not.toBeInTheDocument()
  })

  it('filtros sem resultado usam o estado de "sem resultados", não o vazio inicial', async () => {
    const user = await renderWithData(sampleWarranties())

    await user.type(screen.getByRole('searchbox', { name: /buscar/i }), 'inexistente')

    expect(
      screen.getByRole('heading', { name: /nenhuma garantia corresponde/i }),
    ).toBeInTheDocument()
    // O estado vazio de primeira utilização não deve aparecer.
    expect(screen.queryByText('Suas garantias ficam aqui')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /adicionar compra/i }),
    ).not.toBeInTheDocument()
  })
})