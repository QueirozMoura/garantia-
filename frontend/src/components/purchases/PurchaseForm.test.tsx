// Testes do formulário de compra (PurchaseForm), focados no campo Categoria:
// select com a lista central + opção "Outra" (texto livre), preservando valores
// existentes fora da lista ao editar. Nada aqui chama a API (o envio é do pai).
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CUSTOM_CATEGORY_OPTION } from '../../lib/categories.ts'
import { PurchaseForm } from './PurchaseForm.tsx'
import type { PurchaseFormFields } from './purchase-form.ts'

const baseFields: PurchaseFormFields = {
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  serialNumber: 'SN-12345',
  store: 'Magazine Luiza',
  purchaseDate: '2026-01-15',
  price: '8749.90',
  category: '',
}

function renderForm(initialFields: PurchaseFormFields = baseFields, onSubmit = vi.fn()) {
  const user = userEvent.setup()
  render(
    <PurchaseForm
      initialFields={initialFields}
      submitLabel="Salvar compra"
      isSubmitting={false}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />,
  )
  return { user, onSubmit }
}

describe('PurchaseForm — campo Categoria (select)', () => {
  it('renderiza um select com a lista central e a opção "Outra"', () => {
    renderForm()

    const select = screen.getByLabelText(/Categoria/) as HTMLSelectElement
    const options = Array.from(select.options).map((option) => option.value)

    expect(options).toContain('Informática')
    expect(options).toContain('Casa e decoração')
    expect(options).toContain(CUSTOM_CATEGORY_OPTION)
  })

  it('seleciona uma categoria padrão e envia no payload', async () => {
    const { user, onSubmit } = renderForm()

    await user.selectOptions(screen.getByLabelText(/Categoria/), 'Eletrodomésticos')
    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ category: 'Eletrodomésticos' })
  })

  it('"Outra" revela o texto livre e envia a categoria personalizada', async () => {
    const { user, onSubmit } = renderForm()

    await user.selectOptions(screen.getByLabelText(/Categoria/), CUSTOM_CATEGORY_OPTION)
    await user.type(
      screen.getByLabelText(/Categoria personalizada/),
      'Instrumentos musicais',
    )
    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      category: 'Instrumentos musicais',
    })
  })

  it('preserva na edição uma categoria existente fora da lista', () => {
    renderForm({ ...baseFields, category: 'electronics' })

    // O select assume "Outra" e o texto livre mantém o valor original.
    expect(screen.getByLabelText(/^Categoria \*/)).toHaveValue(CUSTOM_CATEGORY_OPTION)
    expect(screen.getByLabelText(/Categoria personalizada/)).toHaveValue('electronics')
  })

  it('não força o texto livre quando a categoria existente está na lista', () => {
    renderForm({ ...baseFields, category: 'Móveis' })

    expect(screen.getByLabelText(/^Categoria \*/)).toHaveValue('Móveis')
    expect(screen.queryByLabelText(/Categoria personalizada/)).not.toBeInTheDocument()
  })

  it('exige categoria ao salvar (validação existente preservada)', async () => {
    const { user, onSubmit } = renderForm()

    await user.click(screen.getByRole('button', { name: 'Salvar compra' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Informe a categoria.')).toBeInTheDocument()
  })
})
