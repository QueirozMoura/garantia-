// Testes do painel de revisão de extração (DocumentExtractionPanel), usado no
// fluxo de PurchaseDetails. Foco no campo Categoria: começa vazio quando a IA
// não a extraiu, é editável e respeita o mesmo limite do formulário manual.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentExtraction } from '../../types/document.ts'
import { CATEGORY_MAX } from './purchase-form.ts'
import { DocumentExtractionPanel } from './DocumentExtractionPanel.tsx'

const makeExtraction = (
  overrides: Partial<DocumentExtraction> = {},
): DocumentExtraction => ({
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  purchaseDate: '2026-01-15',
  price: 8749.9,
  store: 'Magazine Luiza',
  invoiceNumber: null,
  warrantyMonths: null,
  category: null,
  ...overrides,
})

function renderPanel(data: DocumentExtraction, onConfirm = vi.fn()) {
  const user = userEvent.setup()
  render(<DocumentExtractionPanel data={data} onClose={vi.fn()} onConfirm={onConfirm} />)
  return { user, onConfirm }
}

describe('DocumentExtractionPanel — campo Categoria', () => {
  it('exibe o campo Categoria mesmo quando a extração não a traz', () => {
    renderPanel(makeExtraction({ category: null }))

    expect(screen.getByLabelText('Categoria')).toHaveValue('')
  })

  it('permite editar a categoria e repassa em onConfirm', async () => {
    const { user, onConfirm } = renderPanel(makeExtraction({ category: null }))

    await user.type(screen.getByLabelText('Categoria'), 'Eletrônicos')
    await user.click(screen.getByRole('button', { name: 'Usar estes dados' }))

    expect(onConfirm.mock.calls[0][0]).toMatchObject({ category: 'Eletrônicos' })
  })

  it('bloqueia a confirmação quando a categoria excede o limite', async () => {
    const { user, onConfirm } = renderPanel(makeExtraction())

    await user.type(screen.getByLabelText('Categoria'), 'a'.repeat(CATEGORY_MAX + 1))
    await user.click(screen.getByRole('button', { name: 'Usar estes dados' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      screen.getByText(`A categoria deve ter no máximo ${CATEGORY_MAX} caracteres.`),
    ).toBeInTheDocument()
  })
})
