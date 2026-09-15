import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { GuestModeBanner } from './GuestModeBanner.tsx'

function renderBanner() {
  return render(
    <MemoryRouter>
      <GuestModeBanner />
    </MemoryRouter>,
  )
}

describe('GuestModeBanner', () => {
  it('exibe o modo visitante e links de autenticação', () => {
    renderBanner()

    expect(
      screen.getByRole('complementary', { name: 'Modo visitante' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Você está no modo visitante.')).toBeInTheDocument()
  })

  it('o botão Entrar aponta para /login', () => {
    renderBanner()

    expect(screen.getByRole('link', { name: /entrar/i })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('o botão Criar conta aponta para /register', () => {
    renderBanner()

    expect(screen.getByRole('link', { name: /criar conta/i })).toHaveAttribute(
      'href',
      '/register',
    )
  })
})
