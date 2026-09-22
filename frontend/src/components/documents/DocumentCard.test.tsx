import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { DocumentWithPurchase } from '../../types/document.ts'
import { DocumentCard } from './DocumentCard.tsx'

const makeDocument = (
  overrides: Partial<DocumentWithPurchase> = {},
): DocumentWithPurchase => ({
  id: 'doc-1',
  purchaseId: 'p-7',
  name: 'Nota fiscal',
  fileName: 'nota.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  type: 'INVOICE',
  createdAt: '2026-01-16T00:00:00.000Z',
  updatedAt: '2026-01-16T00:00:00.000Z',
  purchase: {
    id: 'p-7',
    productName: 'Notebook Ultra',
    brand: 'Dell',
    model: 'XPS',
    store: 'Loja',
    purchaseDate: '2026-01-15',
  },
  ...overrides,
})

const renderCard = (document: DocumentWithPurchase) =>
  render(
    <MemoryRouter>
      <DocumentCard document={document} onDeleted={vi.fn()} onAuthError={vi.fn()} />
    </MemoryRouter>,
  )

describe('DocumentCard', () => {
  it('o link "Ver compra" navega para a compra correta com um único anchor', () => {
    renderCard(makeDocument())

    const link = screen.getByRole('link', { name: /ver compra/i })
    expect(link).toHaveAttribute('href', '/purchases/p-7')
    expect(document.querySelectorAll('a')).toHaveLength(1)
  })
})
