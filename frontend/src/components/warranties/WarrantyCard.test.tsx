// Testes do link "Ver compra" do card de Garantias: deve apontar para a
// página da compra já com o fragmento da seção de garantia.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { WarrantyWithPurchase } from '../../types/warranty.ts'
import { WarrantyCard } from './WarrantyCard.tsx'

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
      brand: 'Dell',
      model: 'XPS 15',
      purchaseDate: isoDaysFromNow(-100),
      category: 'Informática',
      ...purchase,
    },
    ...overrides,
  }
}

function renderCard(warranty: WarrantyWithPurchase) {
  return render(
    <MemoryRouter initialEntries={['/warranties']}>
      <WarrantyCard warranty={warranty} />
    </MemoryRouter>,
  )
}

describe('WarrantyCard — link "Ver compra"', () => {
  it('aponta para a URL da compra com o fragmento da seção de garantia', () => {
    const warranty = makeWarranty({}, { id: 'purchase-42' })

    renderCard(warranty)

    expect(screen.getByRole('link', { name: /ver compra/i })).toHaveAttribute(
      'href',
      '/purchases/purchase-42#warranty',
    )
  })

  it('o fragmento corresponde ao id "warranty" existente na página de detalhes', () => {
    const warranty = makeWarranty({}, { id: 'purchase-7' })

    const { container } = render(
      <MemoryRouter initialEntries={['/purchases/purchase-7#warranty']}>
        <Routes>
          <Route
            path="/purchases/:id"
            element={
              <div>
                {/* Anchor semântico que a página de detalhes expõe. */}
                <section id="warranty">Seção de garantia</section>
              </div>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    renderCard(warranty)
    const link = screen.getByRole('link', { name: /ver compra/i })
    const hash = link.getAttribute('href')!.split('#')[1]

    // O destino renderizado contém o elemento com o id do fragmento do link.
    expect(container.querySelector(`#${hash}`)).not.toBeNull()
    expect(hash).toBe('warranty')
  })

  it('continua sendo um link de rota interno (não abre nova aba nem recarrega)', () => {
    const warranty = makeWarranty({}, { id: 'purchase-9' })

    renderCard(warranty)

    const link = screen.getByRole('link', { name: /ver compra/i })
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })

  it('exibe o rótulo "Categoria" com o valor quando a categoria está preenchida', () => {
    const warranty = makeWarranty({}, { category: 'Informática' })

    renderCard(warranty)

    expect(screen.getByText('Categoria')).toBeInTheDocument()
    expect(screen.getByText('Informática')).toBeInTheDocument()
  })

  it('omite o rótulo "Categoria" quando a categoria está vazia', () => {
    const warranty = makeWarranty({}, { category: '' })

    renderCard(warranty)

    expect(screen.queryByText('Categoria')).not.toBeInTheDocument()
  })

  it('omite o rótulo "Categoria" quando a categoria contém apenas espaços', () => {
    const warranty = makeWarranty({}, { category: '   ' })

    renderCard(warranty)

    // O rótulo "Duração" continua presente (layout dos demais campos intacto).
    expect(screen.getByText('Duração')).toBeInTheDocument()
    expect(screen.queryByText('Categoria')).not.toBeInTheDocument()
  })

  it('mantém os demais dados/status da garantia inalterados', () => {
    const warranty = makeWarranty(
      { durationMonths: 24 },
      { productName: 'Notebook Dell XPS', brand: 'Dell', model: 'XPS 15' },
    )

    renderCard(warranty)

    expect(screen.getByText('Notebook Dell XPS')).toBeInTheDocument()
    expect(screen.getByText('Dell XPS 15')).toBeInTheDocument()
    expect(screen.getByText('24 meses')).toBeInTheDocument()
    // Status derivado continua sendo exibido (garantia ativa: término futuro).
    expect(screen.getByText('Ativa')).toBeInTheDocument()
  })
})
