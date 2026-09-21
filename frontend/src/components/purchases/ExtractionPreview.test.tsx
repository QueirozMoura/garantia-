// Testes da etapa de revisão dos dados extraídos (ExtractionPreview), focados
// no campo Categoria: a IA ainda não extrai categoria, então ela começa vazia
// (nunca um valor inventado), é editável e respeita o mesmo limite do
// formulário manual (CATEGORY_MAX). Nada é persistido nesta etapa.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentExtraction } from '../../types/document.ts'
import { CATEGORY_MAX } from './purchase-form.ts'
import { ExtractionPreview } from './ExtractionPreview.tsx'

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

function renderPreview(data: DocumentExtraction, onContinue = vi.fn()) {
  const user = userEvent.setup()
  render(<ExtractionPreview data={data} onContinue={onContinue} onBack={vi.fn()} />)
  return { user, onContinue }
}

describe('ExtractionPreview — campo Categoria', () => {
  it('exibe o campo Categoria na revisão', () => {
    renderPreview(makeExtraction())

    expect(screen.getByLabelText('Categoria')).toBeInTheDocument()
  })

  it('começa vazio quando a extração não traz categoria (null) — sem valor inventado', () => {
    renderPreview(makeExtraction({ category: null }))

    expect(screen.getByLabelText('Categoria')).toHaveValue('')
  })

  it('começa vazio quando o campo category está ausente da extração', () => {
    const data = makeExtraction()
    // Simula resposta do backend sem a chave `category` (ainda não é enviada).
    delete (data as Partial<DocumentExtraction>).category

    renderPreview(data)

    expect(screen.getByLabelText('Categoria')).toHaveValue('')
  })

  it('pré-preenche a categoria quando ela já vem na extração', () => {
    renderPreview(makeExtraction({ category: 'Informática' }))

    expect(screen.getByLabelText('Categoria')).toHaveValue('Informática')
  })

  it('permite editar a categoria e repassa o valor revisado em onContinue', async () => {
    const { user, onContinue } = renderPreview(makeExtraction({ category: null }))

    await user.type(screen.getByLabelText('Categoria'), 'Eletrônicos')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onContinue.mock.calls[0][0]).toMatchObject({ category: 'Eletrônicos' })
  })

  it('envia category null quando o campo fica vazio (não inventa valor)', async () => {
    const { user, onContinue } = renderPreview(makeExtraction({ category: null }))

    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(onContinue.mock.calls[0][0]).toMatchObject({ category: null })
  })

  it(`aceita categoria com exatamente ${CATEGORY_MAX} caracteres (mesmo limite do formulário manual)`, async () => {
    const { user, onContinue } = renderPreview(makeExtraction())
    const value = 'a'.repeat(CATEGORY_MAX)

    await user.type(screen.getByLabelText('Categoria'), value)
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onContinue.mock.calls[0][0]).toMatchObject({ category: value })
  })

  it('bloqueia o Continuar e exibe erro quando a categoria excede o limite', async () => {
    const { user, onContinue } = renderPreview(makeExtraction())

    await user.type(screen.getByLabelText('Categoria'), 'a'.repeat(CATEGORY_MAX + 1))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(onContinue).not.toHaveBeenCalled()
    expect(
      screen.getByText(`A categoria deve ter no máximo ${CATEGORY_MAX} caracteres.`),
    ).toBeInTheDocument()
  })

  it('o fluxo continua funcionando sem categoria preenchida (outros campos válidos)', async () => {
    const { user, onContinue } = renderPreview(makeExtraction({ category: null }))

    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onContinue.mock.calls[0][0]).toMatchObject({
      productName: 'Notebook Dell XPS 15',
      category: null,
    })
  })
})
