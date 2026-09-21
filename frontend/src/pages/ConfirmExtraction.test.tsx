// Testes da confirmação final da extração (ConfirmExtraction), focados na
// exibição de Categoria no resumo dos dados revisados. A categoria revisada é
// enviada na confirmação e persistida pelo backend em `Purchase.category`.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../contexts/auth-context.ts'
import { makeAuthValue } from '../test/auth-test-utils.tsx'
import type { DocumentExtraction } from '../types/document.ts'
import { ConfirmExtraction } from './ConfirmExtraction.tsx'

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return { ...actual, confirmDocumentExtraction: vi.fn() }
})

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
  warrantyMonths: 12,
  category: 'Informática',
  ...overrides,
})

function renderConfirm(extraction: DocumentExtraction) {
  const state = { purchaseId: 'purchase-1', documentId: 'doc-1', extraction }
  render(
    <AuthContext.Provider value={makeAuthValue('authenticated')}>
      <MemoryRouter initialEntries={[{ pathname: '/purchases/new/confirm', state }]}>
        <Routes>
          <Route path="/purchases/new/confirm" element={<ConfirmExtraction />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ConfirmExtraction — resumo com Categoria', () => {
  it('exibe o rótulo e o valor da categoria junto dos demais dados', () => {
    renderConfirm(makeExtraction({ category: 'Informática' }))

    expect(screen.getByText('Categoria')).toBeInTheDocument()
    expect(screen.getByText('Informática')).toBeInTheDocument()
  })

  it('mostra "Não informado" quando a categoria está ausente (null)', () => {
    renderConfirm(makeExtraction({ category: null }))

    expect(screen.getByText('Categoria')).toBeInTheDocument()
    expect(screen.getByText('Não informado')).toBeInTheDocument()
  })

  it('continua exibindo os demais campos do resumo', () => {
    renderConfirm(makeExtraction())

    for (const label of [
      'Produto',
      'Marca',
      'Modelo',
      'Data da compra',
      'Valor',
      'Loja',
      'Garantia',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})
