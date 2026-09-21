// Testes do painel de revisão de extração (DocumentExtractionPanel), usado no
// fluxo de PurchaseDetails. Foco no campo Categoria: select com a lista central
// + opção "Outra". Neste fluxo a categoria é OPCIONAL — vazia continua "não
// informado" e nada é inventado.
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
  it('exibe o select de Categoria vazio quando a extração não a traz', () => {
    renderPanel(makeExtraction({ category: null }))

    expect(screen.getByLabelText('Categoria')).toHaveValue('')
  })

  it('mostra a lista centralizada como opções do select', () => {
    renderPanel(makeExtraction())

    const select = screen.getByLabelText('Categoria') as HTMLSelectElement
    const options = Array.from(select.options).map((option) => option.value)

    for (const category of ['Informática', 'Eletrônicos', 'Casa e decoração', 'Outros']) {
      expect(options).toContain(category)
    }
    expect(options).toContain('Outra')
  })

  it('permite selecionar uma categoria padrão e repassa em onConfirm', async () => {
    const { user, onConfirm } = renderPanel(makeExtraction({ category: null }))

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Eletrônicos')
    await user.click(screen.getByRole('button', { name: 'Usar estes dados' }))

    expect(onConfirm.mock.calls[0][0]).toMatchObject({ category: 'Eletrônicos' })
  })

  it('"Outra" revela o texto livre e usa a categoria personalizada', async () => {
    const { user, onConfirm } = renderPanel(makeExtraction({ category: null }))

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Outra')
    await user.type(
      screen.getByLabelText('Categoria personalizada'),
      'Instrumentos musicais',
    )
    await user.click(screen.getByRole('button', { name: 'Usar estes dados' }))

    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      category: 'Instrumentos musicais',
    })
  })

  it('representa como "Outra" uma categoria fora da lista, sem perdê-la', () => {
    renderPanel(makeExtraction({ category: 'Geladeira' }))

    const select = screen.getByLabelText('Categoria') as HTMLSelectElement
    expect(select).toHaveValue('Outra')
    expect(screen.getByLabelText('Categoria personalizada')).toHaveValue('Geladeira')
  })

  it('sem categoria, confirma enviando null (comportamento opcional preservado)', async () => {
    const { user, onConfirm } = renderPanel(makeExtraction({ category: null }))

    await user.click(screen.getByRole('button', { name: 'Usar estes dados' }))

    expect(onConfirm.mock.calls[0][0]).toMatchObject({ category: null })
  })

  it('bloqueia a confirmação quando a categoria personalizada excede o limite', async () => {
    const { user, onConfirm } = renderPanel(makeExtraction())

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Outra')
    await user.type(
      screen.getByLabelText('Categoria personalizada'),
      'a'.repeat(CATEGORY_MAX + 1),
    )
    await user.click(screen.getByRole('button', { name: 'Usar estes dados' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      screen.getByText(`A categoria deve ter no máximo ${CATEGORY_MAX} caracteres.`),
    ).toBeInTheDocument()
  })
})
