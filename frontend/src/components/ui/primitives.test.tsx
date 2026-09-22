import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Link } from 'react-router-dom'
import { Badge } from './Badge.tsx'
import { Button } from './Button.tsx'
import { Card } from './Card.tsx'
import { FeedbackMessage } from './FeedbackMessage.tsx'
import { IconButton } from './IconButton.tsx'
import { Skeleton, SkeletonCard } from './Skeleton.tsx'
import { StatusBadge } from './StatusBadge.tsx'

describe('visual primitives', () => {
  it('renders Card variants and Button variants', () => {
    render(
      <>
        <Card variant="highlight">Destaque</Card>
        <Button variant="danger">Remover</Button>
      </>,
    )

    expect(screen.getByText('Destaque')).toHaveClass('border-emerald-200')
    expect(screen.getByRole('button', { name: 'Remover' })).toHaveClass('bg-red-600')
  })

  it('supports disabled and loading Button states', () => {
    render(<Button loading>Salvar</Button>)
    const button = screen.getByRole('button', { name: 'Salvar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('asChild + Link renders a single anchor with the correct content', () => {
    render(
      <MemoryRouter>
        <Button variant="secondary" asChild>
          <Link to="/exemplo">Ver compra</Link>
        </Button>
      </MemoryRouter>,
    )

    // Um único <a>, sem anchor aninhado (Button.asChild não reembrulha o Link).
    const anchors = screen.getAllByRole('link')
    expect(anchors).toHaveLength(1)
    expect(document.querySelectorAll('a')).toHaveLength(1)
    const anchor = screen.getByRole('link', { name: 'Ver compra' })
    expect(anchor).toHaveAttribute('href', '/exemplo')
    // Mantém o estilo visual do botão mesclado ao className do Link.
    expect(anchor).toHaveClass('bg-white')
  })

  it('asChild preserves left/right icons and loading without nesting the child', () => {
    render(
      <MemoryRouter>
        <Button asChild leftIcon={<span data-testid="left-icon" />}>
          <Link to="/x">Ir</Link>
        </Button>
      </MemoryRouter>,
    )

    expect(document.querySelectorAll('a')).toHaveLength(1)
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir' })).toBeInTheDocument()
  })

  it('provides an accessible IconButton and Badge variants', () => {
    render(
      <>
        <IconButton label="Fechar">x</IconButton>
        <Badge variant="success">Ativa</Badge>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeVisible()
    expect(screen.getByText('Ativa')).toHaveClass('bg-emerald-50')
  })

  it('maps real warranty statuses semantically', () => {
    render(
      <>
        <StatusBadge status="active" />
        <StatusBadge status="expiring" />
        <StatusBadge status="ACTIVE" />
        <StatusBadge status="NONE" />
      </>,
    )
    expect(screen.getAllByText('Ativa')).toHaveLength(2)
    expect(screen.getByText('Vencendo em breve')).toBeVisible()
    expect(screen.getByText('Sem garantia')).toBeVisible()
  })

  it('renders feedback with status semantics and close action', () => {
    const onClose = () => undefined
    render(
      <FeedbackMessage
        variant="error"
        title="Não foi possível salvar"
        description="Tente novamente."
        onClose={onClose}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Tente novamente.')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar mensagem' }))
  })

  it('renders skeleton primitives as non-content placeholders', () => {
    render(
      <>
        <Skeleton data-testid="skeleton" />
        <SkeletonCard />
      </>,
    )
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })
})
