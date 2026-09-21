// Testes da etapa de revisão dos dados extraídos (ExtractionPreview), focados
// no campo Categoria: select com a lista central + opção "Outra" (texto livre).
// Neste fluxo a categoria é OPCIONAL: vazia continua significando "não
// informado" e nada é inventado.
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
  it('exibe o select de Categoria na revisão', () => {
    renderPreview(makeExtraction())

    expect(screen.getByLabelText('Categoria')).toBeInTheDocument()
  })

  it('mostra a lista centralizada como opções do select', () => {
    renderPreview(makeExtraction())

    const select = screen.getByLabelText('Categoria') as HTMLSelectElement
    const options = Array.from(select.options).map((option) => option.value)

    for (const category of ['Informática', 'Eletrônicos', 'Eletrodomésticos', 'Outros']) {
      expect(options).toContain(category)
    }
    expect(options).toContain('Outra')
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

  it('pré-seleciona a categoria quando ela já vem na lista', () => {
    renderPreview(makeExtraction({ category: 'Informática' }))

    expect(screen.getByLabelText('Categoria')).toHaveValue('Informática')
  })

  it('representa como "Outra" uma categoria fora da lista, sem perdê-la', () => {
    renderPreview(makeExtraction({ category: 'electronics' }))

    const select = screen.getByLabelText('Categoria') as HTMLSelectElement
    expect(select).toHaveValue('Outra')
    expect(screen.getByLabelText('Categoria personalizada')).toHaveValue('electronics')
  })

  it('permite selecionar uma categoria padrão e repassa em onContinue', async () => {
    const { user, onContinue } = renderPreview(makeExtraction({ category: null }))

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Eletrônicos')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onContinue.mock.calls[0][0]).toMatchObject({ category: 'Eletrônicos' })
  })

  it('"Outra" revela o texto livre e usa a categoria personalizada', async () => {
    const { user, onContinue } = renderPreview(makeExtraction({ category: null }))

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Outra')
    await user.type(
      screen.getByLabelText('Categoria personalizada'),
      'Instrumentos musicais',
    )
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(onContinue.mock.calls[0][0]).toMatchObject({
      category: 'Instrumentos musicais',
    })
  })

  it('envia category null quando o campo fica vazio (não inventa valor)', async () => {
    const { user, onContinue } = renderPreview(makeExtraction({ category: null }))

    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(onContinue.mock.calls[0][0]).toMatchObject({ category: null })
  })

  it(`aceita categoria personalizada com exatamente ${CATEGORY_MAX} caracteres`, async () => {
    const { user, onContinue } = renderPreview(makeExtraction())
    const value = 'a'.repeat(CATEGORY_MAX)

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Outra')
    await user.type(screen.getByLabelText('Categoria personalizada'), value)
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onContinue.mock.calls[0][0]).toMatchObject({ category: value })
  })

  it('bloqueia o Continuar e exibe erro quando a categoria personalizada excede o limite', async () => {
    const { user, onContinue } = renderPreview(makeExtraction())

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Outra')
    await user.type(
      screen.getByLabelText('Categoria personalizada'),
      'a'.repeat(CATEGORY_MAX + 1),
    )
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
