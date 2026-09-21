// Testes do resumo (cards de indicadores) da página de Garantias, com foco no
// card "Ainda não iniciada" (status `upcoming`), que antes não era representado.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WarrantyWithPurchase } from '../../types/warranty.ts'
import { WarrantiesSummary } from './WarrantiesSummary.tsx'

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

/** Ativa (término 200d), vencendo (término 10d), expirada (término -10d). */
const activeWarranty = () => makeWarranty({ endDate: isoDaysFromNow(200) })
const expiringWarranty = () => makeWarranty({ endDate: isoDaysFromNow(10) })
const expiredWarranty = () => makeWarranty({ endDate: isoDaysFromNow(-10) })
/** Ainda não iniciada: começa em 60 dias e termina depois. */
const upcomingWarranty = () =>
  makeWarranty({
    startDate: isoDaysFromNow(60),
    endDate: isoDaysFromNow(400),
  })

/** Botão do card (só existe quando `onSelectStatus` é informado). */
function cardButton(title: string) {
  return screen.getByRole('button', { name: `Filtrar garantias: ${title}` })
}

/**
 * Lê o contador do card pelo título visível, sem depender de ser botão ou div
 * (quando não há `onSelectStatus`, o card é renderizado como <div>).
 */
function cardCount(title: string) {
  const titleEl = screen.getByText(title)
  // Sobe até o container do card (div ou button) que contém o contador.
  let node: HTMLElement | null = titleEl
  while (node && !node.querySelector('p.text-3xl')) node = node.parentElement
  return node?.querySelector('p.text-3xl')?.textContent
}

describe('WarrantiesSummary — card "Ainda não iniciada"', () => {
  it('contabiliza garantias upcoming no novo card', () => {
    const list = [activeWarranty(), upcomingWarranty(), upcomingWarranty()]

    render(<WarrantiesSummary warranties={list} />)

    expect(cardCount('Ainda não iniciada')).toBe('2')
  })

  it('exibe o texto "Ainda não iniciada"', () => {
    render(<WarrantiesSummary warranties={[upcomingWarranty()]} />)

    expect(screen.getByText('Ainda não iniciada')).toBeInTheDocument()
  })

  it('clicar no card aplica o filtro upcoming', async () => {
    const user = userEvent.setup()
    const onSelectStatus = vi.fn()
    render(
      <WarrantiesSummary
        warranties={[activeWarranty(), upcomingWarranty()]}
        onSelectStatus={onSelectStatus}
      />,
    )

    await user.click(cardButton('Ainda não iniciada'))

    expect(onSelectStatus).toHaveBeenCalledWith('upcoming')
  })

  it('clicar novamente (card já ativo) permite voltar ao estado sem filtro', async () => {
    const user = userEvent.setup()
    // O pai decide o toggle: quando o status já está ativo, ele limpa o filtro.
    const onSelectStatus = vi.fn()
    render(
      <WarrantiesSummary
        warranties={[upcomingWarranty()]}
        activeStatus="upcoming"
        onSelectStatus={onSelectStatus}
      />,
    )

    const card = cardButton('Ainda não iniciada')
    // O card ativo é marcado acessivelmente e exibido como "Filtrando".
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Filtrando')).toBeInTheDocument()

    await user.click(card)

    // O pai recebe o mesmo status e decide limpar (comportamento de toggle).
    expect(onSelectStatus).toHaveBeenCalledWith('upcoming')
  })

  it('os outros três cards continuam com as contagens corretas', () => {
    const list = [
      activeWarranty(),
      activeWarranty(),
      expiringWarranty(),
      expiredWarranty(),
      expiredWarranty(),
      expiredWarranty(),
      upcomingWarranty(),
    ]

    render(<WarrantiesSummary warranties={list} />)

    expect(cardCount('Proteção vigente')).toBe('2')
    expect(cardCount('Requer atenção')).toBe('1')
    expect(cardCount('Proteção encerrada')).toBe('3')
    expect(cardCount('Ainda não iniciada')).toBe('1')
  })

  it('lista só de garantias upcoming não produz contadores incorretos', () => {
    const list = [upcomingWarranty(), upcomingWarranty(), upcomingWarranty()]

    render(<WarrantiesSummary warranties={list} />)

    expect(cardCount('Ainda não iniciada')).toBe('3')
    expect(cardCount('Proteção vigente')).toBe('0')
    expect(cardCount('Requer atenção')).toBe('0')
    expect(cardCount('Proteção encerrada')).toBe('0')
  })

  it('a soma dos quatro cards fecha com o total de garantias', () => {
    const list = [
      activeWarranty(),
      activeWarranty(),
      expiringWarranty(),
      expiredWarranty(),
      upcomingWarranty(),
      upcomingWarranty(),
    ]

    render(<WarrantiesSummary warranties={list} />)

    const sum = [
      'Proteção vigente',
      'Requer atenção',
      'Proteção encerrada',
      'Ainda não iniciada',
    ].reduce((total, title) => total + Number(cardCount(title)), 0)

    expect(sum).toBe(list.length)
  })
})
