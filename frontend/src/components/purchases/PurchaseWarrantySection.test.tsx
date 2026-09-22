// Testes do CRUD de garantia (PurchaseWarrantySection).
//
// Executamos o componente REAL e mockamos apenas as funções públicas de
// src/lib/api.ts (sem request real, sem backend). Erros usam as classes REAIS
// `ApiError`/`AuthenticationError` para o componente exercitar seu tratamento.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import {
  ApiError,
  AuthenticationError,
  getPurchaseWarranty,
  createPurchaseWarranty,
  updatePurchaseWarranty,
  deletePurchaseWarranty,
} from '../../lib/api.ts'
import { AuthContext, type AuthContextValue } from '../../contexts/auth-context.ts'
import type { Warranty } from '../../types/warranty.ts'
import { PurchaseWarrantySection } from './PurchaseWarrantySection.tsx'

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api.ts')>()
  return {
    ...actual,
    getPurchaseWarranty: vi.fn(),
    createPurchaseWarranty: vi.fn(),
    updatePurchaseWarranty: vi.fn(),
    deletePurchaseWarranty: vi.fn(),
  }
})

const mockGet = vi.mocked(getPurchaseWarranty)
const mockCreate = vi.mocked(createPurchaseWarranty)
const mockUpdate = vi.mocked(updatePurchaseWarranty)
const mockDelete = vi.mocked(deletePurchaseWarranty)

const PURCHASE_ID = 'purchase-7'

const makeWarranty = (overrides: Partial<Warranty> = {}): Warranty => ({
  id: 'warranty-1',
  purchaseId: PURCHASE_ID,
  durationMonths: 12,
  // Datas em meia-noite UTC (formato real do backend).
  startDate: '2026-01-15T00:00:00.000Z',
  endDate: '2100-01-15T00:00:00.000Z',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  ...overrides,
})

describe('PurchaseWarrantySection', () => {
  let expireSession: () => void
  beforeEach(() => {
    vi.clearAllMocks()
    expireSession = vi.fn()
  })

  const renderSection = (props: { initialWarranty?: Warranty | null } = {}) => {
    const user = userEvent.setup()
    const authValue: AuthContextValue = {
      user: null,
      status: 'authenticated',
      isAuthenticated: true,
      isGuest: false,
      isLoading: false,
      logout: vi.fn(),
      expireSession,
      setUser: vi.fn(),
    }
    const utils = render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/purchases/' + PURCHASE_ID]}>
          <Routes>
            <Route
              path="/purchases/:id"
              element={
                <PurchaseWarrantySection
                  purchaseId={PURCHASE_ID}
                  initialWarranty={props.initialWarranty}
                />
              }
            />
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    return { user, ...utils }
  }

  // -----------------------------------------------------------------------
  // 3) Carregamento
  // -----------------------------------------------------------------------
  describe('carregamento', () => {
    it('chama getPurchaseWarranty com o purchaseId, uma única vez, sem escrita', async () => {
      mockGet.mockResolvedValue(null)

      renderSection()

      await screen.findByText('Esta compra ainda não possui garantia')
      expect(mockGet).toHaveBeenCalledWith(PURCHASE_ID)
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockCreate).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('mostra o skeleton enquanto a API está pendente', () => {
      mockGet.mockReturnValue(new Promise(() => {}))

      renderSection()

      expect(screen.getByLabelText('Carregando garantia')).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // Garantia inicial recebida por prop (evita GET duplicado)
  // -----------------------------------------------------------------------
  describe('initialWarranty (garantia já carregada)', () => {
    it('sem initialWarranty faz o GET normalmente', async () => {
      mockGet.mockResolvedValue(makeWarranty())

      renderSection()

      // Comportamento normal preservado: busca via API e exibe o resultado.
      expect(await screen.findByText('Ativa')).toBeInTheDocument()
      expect(mockGet).toHaveBeenCalledWith(PURCHASE_ID)
      expect(mockGet).toHaveBeenCalledTimes(1)
    })

    it('com initialWarranty exibe a garantia sem chamar getPurchaseWarranty', async () => {
      renderSection({ initialWarranty: makeWarranty() })

      expect(await screen.findByText('Ativa')).toBeInTheDocument()
      expect(screen.getByText('12 meses')).toBeInTheDocument()
      // Nenhum GET: a garantia veio pronta pela prop.
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('com initialWarranty = null mostra o estado vazio sem chamar getPurchaseWarranty', async () => {
      renderSection({ initialWarranty: null })

      expect(
        await screen.findByText('Esta compra ainda não possui garantia'),
      ).toBeInTheDocument()
      expect(mockGet).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // 3) Garantia existente
  // -----------------------------------------------------------------------
  describe('garantia existente', () => {
    it('exibe duração, datas e status "Ativa"', async () => {
      mockGet.mockResolvedValue(makeWarranty())

      renderSection()

      expect(await screen.findByText('Ativa')).toBeInTheDocument()
      expect(screen.getByText('12 meses')).toBeInTheDocument()
      expect(screen.getByText('15/01/2026')).toBeInTheDocument()
      expect(screen.getByText('15/01/2100')).toBeInTheDocument()
      // Ações disponíveis.
      expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Excluir garantia' })).toBeInTheDocument()
    })

    it('exibe "Vencida" quando a data de término está no passado', async () => {
      mockGet.mockResolvedValue(
        makeWarranty({
          startDate: '2000-01-01T00:00:00.000Z',
          endDate: '2001-01-01T00:00:00.000Z',
        }),
      )

      renderSection()

      expect(await screen.findByText('Vencida')).toBeInTheDocument()
    })

    // "Hoje" ancorado na meia-noite UTC, igual à regra canônica do helper.
    const DAY = 24 * 60 * 60 * 1000
    const startOfTodayUtcMs = () => {
      const now = new Date()
      return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    }
    const isoUtcDaysFromToday = (days: number) =>
      new Date(startOfTodayUtcMs() + days * DAY).toISOString()

    it('exibe "Ainda não iniciada" quando a garantia ainda não começou', async () => {
      mockGet.mockResolvedValue(
        makeWarranty({
          startDate: isoUtcDaysFromToday(10),
          endDate: isoUtcDaysFromToday(375),
        }),
      )

      renderSection()

      expect(await screen.findByText('Ainda não iniciada')).toBeInTheDocument()
    })

    it('exibe "Vencendo em breve" quando faltam até 30 dias', async () => {
      mockGet.mockResolvedValue(
        makeWarranty({
          startDate: isoUtcDaysFromToday(-100),
          endDate: isoUtcDaysFromToday(10),
        }),
      )

      renderSection()

      expect(await screen.findByText('Vencendo em breve')).toBeInTheDocument()
    })

    it('vence hoje: mantém "Vencendo em breve" (regra canônica), não "Vencida"', async () => {
      // No dia exato do término o helper central classifica como `expiring`
      // (end === hoje em meia-noite UTC), permanecendo até o fim do dia.
      mockGet.mockResolvedValue(
        makeWarranty({
          startDate: isoUtcDaysFromToday(-365),
          endDate: isoUtcDaysFromToday(0),
        }),
      )

      renderSection()

      expect(await screen.findByText('Vencendo em breve')).toBeInTheDocument()
      expect(screen.queryByText('Vencida')).not.toBeInTheDocument()
    })

    it('exibe "Ativa" quando faltam mais de 30 dias', async () => {
      mockGet.mockResolvedValue(
        makeWarranty({
          startDate: isoUtcDaysFromToday(-100),
          endDate: isoUtcDaysFromToday(200),
        }),
      )

      renderSection()

      expect(await screen.findByText('Ativa')).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 3) Sem garantia
  // -----------------------------------------------------------------------
  describe('sem garantia', () => {
    it('mostra o estado vazio com o botão "Adicionar garantia"', async () => {
      mockGet.mockResolvedValue(null)

      renderSection()

      expect(
        await screen.findByText('Esta compra ainda não possui garantia'),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Adicionar garantia' }),
      ).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 4) Erro no carregamento
  // -----------------------------------------------------------------------
  describe('erro no carregamento', () => {
    it('mostra a mensagem de erro e nenhuma garantia falsa', async () => {
      // Erro não-ApiError → usa a mensagem de fallback do componente.
      mockGet.mockRejectedValue(new Error('boom'))

      renderSection()

      expect(
        await screen.findByText('Não foi possível carregar a garantia. Tente novamente.'),
      ).toBeInTheDocument()
      expect(screen.queryByText('Ativa')).not.toBeInTheDocument()
      expect(
        screen.queryByText('Esta compra ainda não possui garantia'),
      ).not.toBeInTheDocument()
    })

    it('usa a mensagem do ApiError quando presente', async () => {
      mockGet.mockRejectedValue(
        new ApiError('Garantia indisponível', 500, 'INTERNAL_ERROR'),
      )

      renderSection()

      expect(await screen.findByText('Garantia indisponível')).toBeInTheDocument()
    })

    it('retry refaz apenas o carregamento', async () => {
      mockGet.mockRejectedValueOnce(new Error('boom'))
      mockGet.mockResolvedValueOnce(makeWarranty())

      const { user } = renderSection()

      await screen.findByText('Não foi possível carregar a garantia. Tente novamente.')
      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      expect(await screen.findByText('Ativa')).toBeInTheDocument()
      expect(mockGet).toHaveBeenCalledTimes(2)
      expect(mockCreate).not.toHaveBeenCalled()
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('401 encerra a sessão e vai para o login', async () => {
      mockGet.mockRejectedValue(new AuthenticationError())

      renderSection()

      expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
      expect(expireSession).toHaveBeenCalledOnce()
    })
  })

  // -----------------------------------------------------------------------
  // 5) Criação
  // -----------------------------------------------------------------------
  describe('criação', () => {
    const openCreateForm = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Adicionar garantia' }))
    }

    it('abre o formulário com valores iniciais vazios', async () => {
      mockGet.mockResolvedValue(null)

      const { user } = renderSection()
      await openCreateForm(user)

      expect(screen.getByLabelText('Duração da garantia (meses)')).toHaveValue(null)
      expect(screen.getByLabelText('Data de início')).toHaveValue('')
      expect(screen.getByLabelText('Data de término')).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Salvar garantia' })).toBeInTheDocument()
    })

    it('cria com o purchaseId correto e o payload exato', async () => {
      mockGet.mockResolvedValue(null)
      mockCreate.mockResolvedValue(
        makeWarranty({
          durationMonths: 24,
          startDate: '2026-02-01T00:00:00.000Z',
          endDate: '2028-02-01T00:00:00.000Z',
        }),
      )

      const { user } = renderSection()
      await openCreateForm(user)

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '24')
      await user.type(screen.getByLabelText('Data de início'), '2026-02-01')
      await user.type(screen.getByLabelText('Data de término'), '2028-02-01')
      await user.click(screen.getByRole('button', { name: 'Salvar garantia' }))

      await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
      expect(mockCreate).toHaveBeenCalledWith(PURCHASE_ID, {
        durationMonths: 24,
        startDate: '2026-02-01',
        endDate: '2028-02-01',
      })
    })

    it('mostra loading durante a criação', async () => {
      mockGet.mockResolvedValue(null)
      let resolveCreate: ((value: Warranty) => void) | undefined
      mockCreate.mockImplementation(
        () =>
          new Promise<Warranty>((resolve) => {
            resolveCreate = resolve
          }),
      )

      const { user } = renderSection()
      await openCreateForm(user)

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '24')
      await user.type(screen.getByLabelText('Data de início'), '2026-02-01')
      await user.type(screen.getByLabelText('Data de término'), '2028-02-01')
      await user.click(screen.getByRole('button', { name: 'Salvar garantia' }))

      expect(await screen.findByRole('button', { name: 'Salvando...' })).toBeDisabled()

      resolveCreate?.(makeWarranty())
      await screen.findByText('Ativa')
    })

    it('após o sucesso exibe a garantia criada e fecha o formulário', async () => {
      mockGet.mockResolvedValue(null)
      mockCreate.mockResolvedValue(makeWarranty({ durationMonths: 24 }))

      const { user } = renderSection()
      await openCreateForm(user)

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '24')
      await user.type(screen.getByLabelText('Data de início'), '2026-02-01')
      await user.type(screen.getByLabelText('Data de término'), '2028-02-01')
      await user.click(screen.getByRole('button', { name: 'Salvar garantia' }))

      expect(await screen.findByText('24 meses')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Salvar garantia' }),
      ).not.toBeInTheDocument()
      // Nenhum refetch adicional: a resposta é aplicada direto.
      expect(mockGet).toHaveBeenCalledTimes(1)
    })

    it('erro na criação mostra a mensagem do ApiError e mantém o formulário', async () => {
      mockGet.mockResolvedValue(null)
      mockCreate.mockRejectedValue(
        new ApiError('Dados inválidos', 400, 'VALIDATION_ERROR'),
      )

      const { user } = renderSection()
      await openCreateForm(user)

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '12')
      await user.type(screen.getByLabelText('Data de início'), '2026-02-01')
      await user.type(screen.getByLabelText('Data de término'), '2027-02-01')
      await user.click(screen.getByRole('button', { name: 'Salvar garantia' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Dados inválidos')
      expect(screen.getByRole('button', { name: 'Salvar garantia' })).toBeInTheDocument()
    })

    it('erro genérico na criação usa a mensagem de fallback', async () => {
      mockGet.mockResolvedValue(null)
      mockCreate.mockRejectedValue(new Error('boom'))

      const { user } = renderSection()
      await openCreateForm(user)

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '12')
      await user.type(screen.getByLabelText('Data de início'), '2026-02-01')
      await user.type(screen.getByLabelText('Data de término'), '2027-02-01')
      await user.click(screen.getByRole('button', { name: 'Salvar garantia' }))

      expect(
        await screen.findByText('Não foi possível salvar a garantia. Tente novamente.'),
      ).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 6) Validação da criação
  // -----------------------------------------------------------------------
  describe('validação da criação', () => {
    const openCreateForm = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Adicionar garantia' }))
    }

    it('sem duração: erro visível e envio desabilitado (sem POST)', async () => {
      mockGet.mockResolvedValue(null)

      const { user } = renderSection()
      await openCreateForm(user)

      await user.type(screen.getByLabelText('Data de início'), '2026-02-01')
      await user.type(screen.getByLabelText('Data de término'), '2027-02-01')

      expect(screen.getByText('Informe a duração em meses.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar garantia' })).toBeDisabled()
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('duração não inteira/negativa: erro e envio desabilitado', async () => {
      mockGet.mockResolvedValue(null)

      const { user } = renderSection()
      await openCreateForm(user)

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '-3')
      await user.type(screen.getByLabelText('Data de início'), '2026-02-01')
      await user.type(screen.getByLabelText('Data de término'), '2027-02-01')

      expect(
        screen.getByText('A duração deve ser um número inteiro positivo.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar garantia' })).toBeDisabled()
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('data de início vazia: erro e envio desabilitado', async () => {
      mockGet.mockResolvedValue(null)

      const { user } = renderSection()
      await openCreateForm(user)

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '12')
      await user.type(screen.getByLabelText('Data de término'), '2027-02-01')

      expect(screen.getByText('Informe a data de início.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar garantia' })).toBeDisabled()
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('intervalo inválido (término antes do início): erro e envio desabilitado', async () => {
      mockGet.mockResolvedValue(null)

      const { user } = renderSection()
      await openCreateForm(user)

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '12')
      await user.type(screen.getByLabelText('Data de início'), '2026-06-01')
      await user.type(screen.getByLabelText('Data de término'), '2026-01-01')

      expect(
        screen.getByText('A data de término não pode ser anterior à data de início.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar garantia' })).toBeDisabled()
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('usuário corrige os erros e consegue salvar', async () => {
      mockGet.mockResolvedValue(null)
      mockCreate.mockResolvedValue(makeWarranty())

      const { user } = renderSection()
      await openCreateForm(user)

      // Estado inválido inicialmente: envio bloqueado.
      expect(screen.getByRole('button', { name: 'Salvar garantia' })).toBeDisabled()

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '12')
      await user.type(screen.getByLabelText('Data de início'), '2026-02-01')
      await user.type(screen.getByLabelText('Data de término'), '2027-02-01')

      const save = screen.getByRole('button', { name: 'Salvar garantia' })
      expect(save).toBeEnabled()
      await user.click(save)

      await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
      expect(await screen.findByText('Ativa')).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 7) Cancelar criação
  // -----------------------------------------------------------------------
  describe('cancelar criação', () => {
    it('fecha o formulário sem chamar POST e mantém o estado vazio', async () => {
      mockGet.mockResolvedValue(null)

      const { user } = renderSection()
      await user.click(await screen.findByRole('button', { name: 'Adicionar garantia' }))

      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '12')
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(
        await screen.findByText('Esta compra ainda não possui garantia'),
      ).toBeInTheDocument()
      expect(
        screen.queryByLabelText('Duração da garantia (meses)'),
      ).not.toBeInTheDocument()
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // 8) Edição
  // -----------------------------------------------------------------------
  describe('edição', () => {
    const openEdit = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Editar' }))
    }

    it('abre o formulário preenchido com os valores atuais, sem PUT', async () => {
      mockGet.mockResolvedValue(makeWarranty())

      const { user } = renderSection()
      await openEdit(user)

      expect(screen.getByLabelText('Duração da garantia (meses)')).toHaveValue(12)
      expect(screen.getByLabelText('Data de início')).toHaveValue('2026-01-15')
      expect(screen.getByLabelText('Data de término')).toHaveValue('2100-01-15')
      expect(
        screen.getByRole('button', { name: 'Salvar alterações' }),
      ).toBeInTheDocument()
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('salva com o purchaseId correto e o payload exato', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockUpdate.mockResolvedValue(
        makeWarranty({
          durationMonths: 36,
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2029-03-01T00:00:00.000Z',
        }),
      )

      const { user } = renderSection()
      await openEdit(user)

      const duration = screen.getByLabelText('Duração da garantia (meses)')
      await user.clear(duration)
      await user.type(duration, '36')
      const end = screen.getByLabelText('Data de término')
      await user.clear(end)
      await user.type(end, '2029-03-01')
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
      expect(mockUpdate).toHaveBeenCalledWith(PURCHASE_ID, {
        durationMonths: 36,
        startDate: '2026-01-15',
        endDate: '2029-03-01',
      })
    })

    it('mostra loading durante o update', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      let resolveUpdate: ((value: Warranty) => void) | undefined
      mockUpdate.mockImplementation(
        () =>
          new Promise<Warranty>((resolve) => {
            resolveUpdate = resolve
          }),
      )

      const { user } = renderSection()
      await openEdit(user)
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(await screen.findByRole('button', { name: 'Salvando...' })).toBeDisabled()

      resolveUpdate?.(makeWarranty())
      await screen.findByText('Ativa')
    })

    it('após o sucesso aplica a resposta e mostra mensagem de sucesso (sem GET extra)', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockUpdate.mockResolvedValue(makeWarranty({ durationMonths: 36 }))

      const { user } = renderSection()
      await openEdit(user)
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(
        await screen.findByText('Garantia atualizada com sucesso.'),
      ).toBeInTheDocument()
      expect(screen.getByText('36 meses')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Salvar alterações' }),
      ).not.toBeInTheDocument()
      expect(mockGet).toHaveBeenCalledTimes(1)
    })
  })

  // -----------------------------------------------------------------------
  // 9) Cancelar edição
  // -----------------------------------------------------------------------
  describe('cancelar edição', () => {
    it('fecha o modo de edição sem PUT e mantém os valores originais', async () => {
      mockGet.mockResolvedValue(makeWarranty())

      const { user } = renderSection()
      await user.click(await screen.findByRole('button', { name: 'Editar' }))

      const duration = screen.getByLabelText('Duração da garantia (meses)')
      await user.clear(duration)
      await user.type(duration, '99')
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(
        screen.queryByRole('button', { name: 'Salvar alterações' }),
      ).not.toBeInTheDocument()
      expect(screen.getByText('12 meses')).toBeInTheDocument()
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // 10) Erro no update
  // -----------------------------------------------------------------------
  describe('erro no update', () => {
    const openEdit = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Editar' }))
    }

    it('500 mostra a mensagem de fallback e mantém o formulário para tentar de novo', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockUpdate.mockRejectedValueOnce(new ApiError('boom', 500, 'INTERNAL_ERROR'))
      mockUpdate.mockResolvedValueOnce(makeWarranty({ durationMonths: 36 }))

      const { user } = renderSection()
      await openEdit(user)
      const duration = screen.getByLabelText('Duração da garantia (meses)')
      await user.clear(duration)
      await user.type(duration, '36')
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(
        await screen.findByText(
          'Não foi possível atualizar a garantia. Tente novamente.',
        ),
      ).toBeInTheDocument()
      // Valores digitados preservados.
      expect(screen.getByLabelText('Duração da garantia (meses)')).toHaveValue(36)

      // Retry repete SOMENTE o update.
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2))
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(
        await screen.findByText('Garantia atualizada com sucesso.'),
      ).toBeInTheDocument()
    })

    it('INVALID_WARRANTY_DATE_RANGE mostra a mensagem específica', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockUpdate.mockRejectedValue(
        new ApiError('invalid range', 400, 'INVALID_WARRANTY_DATE_RANGE'),
      )

      const { user } = renderSection()
      await openEdit(user)
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(
        await screen.findByText(
          'A data de término não pode ser anterior à data de início.',
        ),
      ).toBeInTheDocument()
    })

    it('VALIDATION_ERROR mostra a mensagem de validação', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockUpdate.mockRejectedValue(new ApiError('invalid', 400, 'VALIDATION_ERROR'))

      const { user } = renderSection()
      await openEdit(user)
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(
        await screen.findByText('Verifique os dados informados e tente novamente.'),
      ).toBeInTheDocument()
    })

    it('403 mostra a mensagem de permissão', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockUpdate.mockRejectedValue(new ApiError('forbidden', 403, 'FORBIDDEN'))

      const { user } = renderSection()
      await openEdit(user)
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(
        await screen.findByText('Você não tem permissão para editar esta garantia.'),
      ).toBeInTheDocument()
    })

    it('404/WARRANTY_NOT_FOUND mostra recarregar a página', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockUpdate.mockRejectedValue(new ApiError('not found', 404, 'WARRANTY_NOT_FOUND'))

      const { user } = renderSection()
      await openEdit(user)
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(
        await screen.findByText(
          'Esta garantia não foi encontrada. Recarregue a página e tente novamente.',
        ),
      ).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 11) Exclusão
  // -----------------------------------------------------------------------
  describe('exclusão', () => {
    const openDeleteDialog = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Excluir garantia' }))
    }

    it('abre a confirmação sem disparar DELETE', async () => {
      mockGet.mockResolvedValue(makeWarranty())

      const { user } = renderSection()
      await openDeleteDialog(user)

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Excluir garantia?')).toBeInTheDocument()
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('cancelar não chama DELETE e a garantia permanece', async () => {
      mockGet.mockResolvedValue(makeWarranty())

      const { user } = renderSection()
      await openDeleteDialog(user)
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(mockDelete).not.toHaveBeenCalled()
      expect(screen.getByText('Ativa')).toBeInTheDocument()
    })

    it('confirmar chama DELETE uma vez com o purchaseId', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockDelete.mockResolvedValue(undefined)

      const { user } = renderSection()
      await openDeleteDialog(user)
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir garantia' }))

      await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(PURCHASE_ID))
      expect(mockDelete).toHaveBeenCalledTimes(1)
    })

    it('após o sucesso volta ao estado vazio sem refetch', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockDelete.mockResolvedValue(undefined)

      const { user } = renderSection()
      await openDeleteDialog(user)
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir garantia' }))

      expect(
        await screen.findByText('Esta compra ainda não possui garantia'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(mockGet).toHaveBeenCalledTimes(1)
    })

    it('após o sucesso exibe a mensagem de sucesso da exclusão', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockDelete.mockResolvedValue(undefined)

      const { user } = renderSection()
      await openDeleteDialog(user)
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir garantia' }))

      expect(await screen.findByText('Garantia excluída com sucesso.')).toBeInTheDocument()
      // A UI já reflete a remoção (estado vazio).
      expect(
        await screen.findByText('Esta compra ainda não possui garantia'),
      ).toBeInTheDocument()
    })

    it('em caso de erro NÃO exibe a mensagem de sucesso', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockDelete.mockRejectedValueOnce(new ApiError('boom', 500, 'INTERNAL_ERROR'))

      const { user } = renderSection()
      await openDeleteDialog(user)
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir garantia' }))

      // Erro exibido no próprio modal; nenhum feedback de sucesso.
      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(
        screen.queryByText('Garantia excluída com sucesso.'),
      ).not.toBeInTheDocument()
      // A garantia continua na tela (não foi removida).
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 12) Erro no delete
  // -----------------------------------------------------------------------
  describe('erro no delete', () => {
    const confirmDelete = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole('button', { name: 'Excluir garantia' }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir garantia' }))
    }

    it('500 mantém o modal aberto com mensagem e permite tentar de novo', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockDelete.mockRejectedValueOnce(new ApiError('boom', 500, 'INTERNAL_ERROR'))
      mockDelete.mockResolvedValueOnce(undefined)

      const { user } = renderSection()
      await confirmDelete(user)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        'Não foi possível excluir a garantia. Tente novamente.',
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Retry do DELETE só repete a exclusão.
      const dialog = screen.getByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir garantia' }))
      await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(2))
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(
        await screen.findByText('Esta compra ainda não possui garantia'),
      ).toBeInTheDocument()
    })

    it('403 mostra a mensagem de permissão', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockDelete.mockRejectedValue(new ApiError('forbidden', 403, 'FORBIDDEN'))

      const { user } = renderSection()
      await confirmDelete(user)

      expect(
        await screen.findByText('Você não tem permissão para excluir esta garantia.'),
      ).toBeInTheDocument()
    })

    it('404 mostra "Esta garantia não foi encontrada."', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockDelete.mockRejectedValue(new ApiError('not found', 404, 'WARRANTY_NOT_FOUND'))

      const { user } = renderSection()
      await confirmDelete(user)

      expect(
        await screen.findByText('Esta garantia não foi encontrada.'),
      ).toBeInTheDocument()
    })

    it('401 encerra a sessão e vai para o login', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      mockDelete.mockRejectedValue(new AuthenticationError())

      const { user } = renderSection()
      await confirmDelete(user)

      expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
      expect(expireSession).toHaveBeenCalledOnce()
    })
  })

  // -----------------------------------------------------------------------
  // 13) Double submit
  // -----------------------------------------------------------------------
  describe('proteção contra chamadas duplicadas', () => {
    it('duplo clique em criar gera apenas 1 POST', async () => {
      mockGet.mockResolvedValue(null)
      let resolveCreate: ((value: Warranty) => void) | undefined
      mockCreate.mockImplementation(
        () =>
          new Promise<Warranty>((resolve) => {
            resolveCreate = resolve
          }),
      )

      const { user } = renderSection()
      await user.click(await screen.findByRole('button', { name: 'Adicionar garantia' }))
      await user.type(screen.getByLabelText('Duração da garantia (meses)'), '12')
      await user.type(screen.getByLabelText('Data de início'), '2026-02-01')
      await user.type(screen.getByLabelText('Data de término'), '2027-02-01')

      const save = screen.getByRole('button', { name: 'Salvar garantia' })
      await Promise.all([user.click(save), user.click(save)])

      expect(mockCreate).toHaveBeenCalledTimes(1)
      resolveCreate?.(makeWarranty())
      await screen.findByText('Ativa')
    })

    it('duplo clique em editar gera apenas 1 PUT', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      let resolveUpdate: ((value: Warranty) => void) | undefined
      mockUpdate.mockImplementation(
        () =>
          new Promise<Warranty>((resolve) => {
            resolveUpdate = resolve
          }),
      )

      const { user } = renderSection()
      await user.click(await screen.findByRole('button', { name: 'Editar' }))
      const save = screen.getByRole('button', { name: 'Salvar alterações' })
      await Promise.all([user.click(save), user.click(save)])

      expect(mockUpdate).toHaveBeenCalledTimes(1)
      resolveUpdate?.(makeWarranty())
      await screen.findByText('Ativa')
    })

    it('duplo clique em confirmar exclusão gera apenas 1 DELETE', async () => {
      mockGet.mockResolvedValue(makeWarranty())
      let resolveDelete: (() => void) | undefined
      mockDelete.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve
          }),
      )

      const { user } = renderSection()
      await user.click(await screen.findByRole('button', { name: 'Excluir garantia' }))
      const dialog = await screen.findByRole('dialog')
      const confirm = within(dialog).getByRole('button', { name: 'Excluir garantia' })
      await Promise.all([user.click(confirm), user.click(confirm)])

      expect(mockDelete).toHaveBeenCalledTimes(1)
      resolveDelete?.()
      await screen.findByText('Esta compra ainda não possui garantia')
    })
  })

  // -----------------------------------------------------------------------
  // 14) Datas
  // -----------------------------------------------------------------------
  describe('tratamento de datas', () => {
    it('as datas ISO viram "YYYY-MM-DD" no formulário sem drift de dia', async () => {
      mockGet.mockResolvedValue(
        makeWarranty({
          // 01:00 UTC de 1º de janeiro: em fusos a oeste isso seria o dia 31/12.
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2030-12-31T00:00:00.000Z',
        }),
      )

      const { user } = renderSection()
      await user.click(await screen.findByRole('button', { name: 'Editar' }))

      expect(screen.getByLabelText('Data de início')).toHaveValue('2026-01-01')
      expect(screen.getByLabelText('Data de término')).toHaveValue('2030-12-31')
    })

    it('envia as datas exatamente como digitadas (sem conversão de fuso)', async () => {
      mockGet.mockResolvedValue(
        makeWarranty({
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2030-12-31T00:00:00.000Z',
        }),
      )
      mockUpdate.mockResolvedValue(makeWarranty())

      const { user } = renderSection()
      await user.click(await screen.findByRole('button', { name: 'Editar' }))
      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      await waitFor(() =>
        expect(mockUpdate).toHaveBeenCalledWith(PURCHASE_ID, {
          durationMonths: 12,
          startDate: '2026-01-01',
          endDate: '2030-12-31',
        }),
      )
    })

    it('exibe as datas em pt-BR na visualização', async () => {
      mockGet.mockResolvedValue(
        makeWarranty({
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2030-12-31T00:00:00.000Z',
        }),
      )

      renderSection()

      expect(await screen.findByText('01/01/2026')).toBeInTheDocument()
      expect(screen.getByText('31/12/2030')).toBeInTheDocument()
    })
  })
})
