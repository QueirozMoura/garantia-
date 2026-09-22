import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Alert } from '../../types/alert.ts'
import { AlertCard } from './AlertCard.tsx'

const DAY = 24 * 60 * 60 * 1000

// Days after UTC midnight of the current day, matching the project's UTC anchor.
const isoUtcDaysFromToday = (days: number) => {
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(todayUtc + days * DAY).toISOString()
}

const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 'alert-1',
  type: 'WARRANTY_EXPIRING',
  title: 'Garantia vencendo',
  message: 'Sua garantia está perto do fim.',
  createdAt: '2026-01-10T00:00:00.000Z',
  warranty: {
    id: 'warranty-1',
    purchaseId: 'p-7',
    startDate: isoUtcDaysFromToday(-100),
    endDate: isoUtcDaysFromToday(10),
  },
  purchase: {
    id: 'p-7',
    productName: 'Notebook Ultra',
    brand: 'Dell',
    model: 'XPS',
    category: 'Informática',
  },
  ...overrides,
})

const renderCard = (alert: Alert) =>
  render(
    <MemoryRouter>
      <AlertCard alert={alert} />
    </MemoryRouter>,
  )

describe('AlertCard', () => {
  it('navega para a seção de garantia da compra correta', () => {
    renderCard(makeAlert())

    const link = screen.getByRole('link', { name: /ver compra/i })
    expect(link).toHaveAttribute('href', '/purchases/p-7#warranty')
    // Um único anchor (sem <a> aninhado).
    expect(document.querySelectorAll('a')).toHaveLength(1)
  })

  it('alerta expirando mostra os dias restantes (UTC)', () => {
    renderCard(
      makeAlert({
        warranty: { ...makeAlert().warranty, endDate: isoUtcDaysFromToday(5) },
      }),
    )

    expect(screen.getByText('5 dias restantes')).toBeInTheDocument()
  })

  it('alerta expirando que vence hoje mostra "Vence hoje"', () => {
    renderCard(
      makeAlert({
        warranty: { ...makeAlert().warranty, endDate: isoUtcDaysFromToday(0) },
      }),
    )

    expect(screen.getByText('Vence hoje')).toBeInTheDocument()
  })

  it('alerta expirado usa a contagem UTC de dias de calendário', () => {
    renderCard(
      makeAlert({
        type: 'WARRANTY_EXPIRED',
        warranty: { ...makeAlert().warranty, endDate: isoUtcDaysFromToday(-3) },
      }),
    )

    // Mesma âncora de calendário do backend (independe da hora do dia).
    expect(screen.getByText('Expirada há 3 dias')).toBeInTheDocument()
  })

  it('alerta expirado há 1 dia usa singular', () => {
    renderCard(
      makeAlert({
        type: 'WARRANTY_EXPIRED',
        warranty: { ...makeAlert().warranty, endDate: isoUtcDaysFromToday(-1) },
      }),
    )

    expect(screen.getByText('Expirada há 1 dia')).toBeInTheDocument()
  })
})
