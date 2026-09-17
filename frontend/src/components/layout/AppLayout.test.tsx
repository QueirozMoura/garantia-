// O GuestModeBanner é montado pelo AppLayout apenas quando o usuário está em
// modo visitante. Estes testes cobrem esse gate (aparece em guest, some em
// authenticated) e checam o Header do shell.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../contexts/auth-context.ts'
import { makeAuthValue } from '../../test/auth-test-utils.tsx'
import { AppLayout } from '../../layouts/AppLayout.tsx'

function renderLayout(status: 'guest' | 'authenticated' | 'loading') {
  return render(
    <AuthContext.Provider value={makeAuthValue(status)}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppLayout activeNavId="dashboard">
          <div>CONTEUDO_DA_PAGINA</div>
        </AppLayout>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('AppLayout — banner de modo visitante', () => {
  it('aparece para guest', () => {
    renderLayout('guest')

    expect(
      screen.getByRole('complementary', { name: 'Modo visitante' }),
    ).toBeInTheDocument()
    expect(screen.getByText('CONTEUDO_DA_PAGINA')).toBeInTheDocument()
  })

  it('NÃO aparece para authenticated', () => {
    renderLayout('authenticated')

    expect(
      screen.queryByRole('complementary', { name: 'Modo visitante' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('CONTEUDO_DA_PAGINA')).toBeInTheDocument()
  })

  it('NÃO aparece durante o loading (evita flicker de guest)', () => {
    renderLayout('loading')

    expect(
      screen.queryByRole('complementary', { name: 'Modo visitante' }),
    ).not.toBeInTheDocument()
  })

  it('mostra exatamente UM banner em guest (sem duplicação)', () => {
    renderLayout('guest')

    expect(screen.getAllByRole('complementary', { name: 'Modo visitante' })).toHaveLength(
      1,
    )
  })
})

describe('Header — modo visitante', () => {
  it('guest mostra "Modo visitante" e CTAs de autenticação, sem dados de usuário', () => {
    renderLayout('guest')

    expect(screen.getByText('Modo visitante')).toBeInTheDocument()
    // Não inventa nome de usuário.
    expect(screen.queryByText(/olá/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('authenticated mostra o usuário e a opção de sair', () => {
    renderLayout('authenticated')

    expect(screen.queryByText('Modo visitante')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Abrir menu do usuário' }),
    ).toBeInTheDocument()
  })
})
