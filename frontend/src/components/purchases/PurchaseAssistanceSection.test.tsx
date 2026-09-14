// Testes do fluxo de Assistência (PurchaseAssistanceSection).
//
// Executamos o componente REAL e mockamos apenas as funções públicas de
// src/lib/api.ts (NÃO fazemos request real, sem backend/Gemini/rede). Erros são
// instanciados com as classes REAIS (ApiError/AuthenticationError) para que o
// componente exercite seu tratamento de erro verdadeiro.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ApiError,
  AuthenticationError,
  analyzeAssistance,
  prepareAssistance,
} from '../../lib/api.ts'
import type { Assistance, AssistanceAnalysis } from '../../types/assistance.ts'
import { PurchaseAssistanceSection } from './PurchaseAssistanceSection.tsx'
import { PROBLEM_MAX_LENGTH } from './assistance-form.ts'

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api.ts')>()
  return {
    ...actual,
    prepareAssistance: vi.fn(),
    analyzeAssistance: vi.fn(),
  }
})

const mockPrepare = vi.mocked(prepareAssistance)
const mockAnalyze = vi.mocked(analyzeAssistance)

const PURCHASE_ID = 'purchase-1'

const makeAssistance = (overrides: Partial<Assistance> = {}): Assistance => ({
  problem: 'A máquina não centrifuga',
  warrantyStatus: 'ACTIVE',
  purchase: {
    id: PURCHASE_ID,
    productName: 'Máquina de lavar',
    brand: 'Brastemp',
    model: 'BWF11',
    store: 'Loja X',
    purchaseDate: '2026-01-15',
  },
  warranty: {
    id: 'warranty-1',
    durationMonths: 12,
    startDate: '2026-01-15T00:00:00.000Z',
    endDate: '2027-01-15T00:00:00.000Z',
  },
  ...overrides,
})

const makeAnalysis = (
  overrides: Partial<AssistanceAnalysis> = {},
): AssistanceAnalysis => ({
  summary: 'A centrífuga pode estar travada.',
  possibleCauses: ['Objeto preso no tambor', 'Correia solta'],
  recommendedAction: 'Verifique o tambor e chame a assistência técnica.',
  safetyNote: 'Desligue da tomada antes de qualquer verificação.',
  warrantyGuidance: 'O reparo é coberto pela garantia vigente.',
  requiredDocuments: ['Nota fiscal', 'Comprovante de compra'],
  ...overrides,
})

/** Renderiza a seção e devolve utilitários de interação. */
const renderSection = (onAuthError = vi.fn()) => {
  const user = userEvent.setup()
  const utils = render(
    <PurchaseAssistanceSection purchaseId={PURCHASE_ID} onAuthError={onAuthError} />,
  )
  const getField = () => screen.getByLabelText('Descreva o problema')
  const submit = () => screen.getByRole('button', { name: 'Solicitar assistência' })
  return { user, onAuthError, getField, submit, ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// -------------------------------------------------------------------------
// 1) Renderização inicial
// -------------------------------------------------------------------------
describe('renderização inicial', () => {
  it('mostra o título da seção, o campo e o botão de envio', () => {
    renderSection()

    expect(
      screen.getByRole('heading', { name: 'Precisa de assistência?' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Descreva o problema')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Solicitar assistência' })).toBeEnabled()
  })

  it('não faz nenhuma chamada à API no mount', () => {
    renderSection()

    expect(mockPrepare).not.toHaveBeenCalled()
    expect(mockAnalyze).not.toHaveBeenCalled()
  })
})

// -------------------------------------------------------------------------
// 2) Validação do problema
// -------------------------------------------------------------------------
describe('validação do problema', () => {
  it('problema vazio não dispara API e mostra erro de validação', async () => {
    const { user, submit } = renderSection()

    await user.click(submit())

    expect(mockPrepare).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Descreva o problema para solicitar assistência.',
    )
  })

  it('problema só com espaços não dispara API', async () => {
    const { user, getField, submit } = renderSection()

    await user.type(getField(), '     ')
    await user.click(submit())

    expect(mockPrepare).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('problema menor que 5 caracteres não dispara API', async () => {
    const { user, getField, submit } = renderSection()

    await user.type(getField(), 'abc')
    await user.click(submit())

    expect(mockPrepare).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('pelo menos 5 caracteres')
  })

  it('problema válido dispara o fluxo de preparação', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockResolvedValue(makeAnalysis())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await waitFor(() => expect(mockPrepare).toHaveBeenCalledTimes(1))
    expect(mockPrepare).toHaveBeenCalledWith(PURCHASE_ID, 'Máquina não centrifuga')
  })

  it('problema acima do máximo é limitado pelo atributo maxLength do campo', () => {
    renderSection()

    const field = screen.getByLabelText('Descreva o problema')
    expect(field).toHaveAttribute('maxlength', String(PROBLEM_MAX_LENGTH))
  })
})

// -------------------------------------------------------------------------
// 3) Preparação da assistência
// -------------------------------------------------------------------------
describe('preparação da assistência', () => {
  it('envia purchaseId e problema trimado pelo endpoint de preparação', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockResolvedValue(makeAnalysis())

    await user.type(getField(), '   Problema com espaços   ')
    await user.click(submit())

    await waitFor(() =>
      expect(mockPrepare).toHaveBeenCalledWith(PURCHASE_ID, 'Problema com espaços'),
    )
  })

  it('mostra loading durante a preparação e desabilita o envio', async () => {
    const { user, getField, submit } = renderSection()

    let resolvePrepare: ((value: Assistance) => void) | undefined
    mockPrepare.mockImplementation(
      () =>
        new Promise<Assistance>((resolve) => {
          resolvePrepare = resolve
        }),
    )

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    expect(await screen.findByText('Verificando sua garantia...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Verificando/ })).toBeDisabled()
    // Análise NÃO inicia enquanto a preparação está pendente.
    expect(mockAnalyze).not.toHaveBeenCalled()

    resolvePrepare?.(makeAssistance())
    mockAnalyze.mockResolvedValue(makeAnalysis())
    await screen.findByText('Garantia ativa')
  })
})

// -------------------------------------------------------------------------
// 4) Resultados de garantia (warrantyStatus exibido, nunca recalculado)
// -------------------------------------------------------------------------
describe('status da garantia exibido', () => {
  const cases: Array<{
    status: Assistance['warrantyStatus']
    title: string
    badge: string
  }> = [
    { status: 'ACTIVE', title: 'Garantia ativa', badge: 'Ativa' },
    { status: 'EXPIRED', title: 'Garantia expirada', badge: 'Expirada' },
    {
      status: 'UPCOMING',
      title: 'Garantia ainda não iniciada',
      badge: 'Ainda não iniciada',
    },
    { status: 'NONE', title: 'Sem garantia cadastrada', badge: 'Sem garantia' },
  ]

  it.each(cases)('exibe $status como "$title"', async ({ status, title, badge }) => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance({ warrantyStatus: status }))
    mockAnalyze.mockResolvedValue(makeAnalysis())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText(badge)).toBeInTheDocument()
  })

  it('sem garantia (warranty null) não exibe as datas da garantia', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(
      makeAssistance({ warrantyStatus: 'NONE', warranty: null }),
    )
    mockAnalyze.mockResolvedValue(makeAnalysis())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await screen.findByRole('heading', { name: 'Sem garantia cadastrada' })
    expect(screen.queryByText('Duração')).not.toBeInTheDocument()
    expect(screen.queryByText('Início da garantia')).not.toBeInTheDocument()
  })

  it('com garantia exibe duração e datas', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockResolvedValue(makeAnalysis())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    const duration = await screen.findByText('Duração')
    const dates = duration.closest('dl') as HTMLElement
    expect(within(dates).getByText('12 meses')).toBeInTheDocument()
    expect(within(dates).getByText('15/01/2026')).toBeInTheDocument()
    expect(within(dates).getByText('15/01/2027')).toBeInTheDocument()
  })
})

// -------------------------------------------------------------------------
// 5) Fluxo de análise IA
// -------------------------------------------------------------------------
describe('fluxo de análise com IA', () => {
  it('chama /analyze somente DEPOIS da preparação bem-sucedida, sem GET adicional', async () => {
    const { user, getField, submit } = renderSection()

    const order: string[] = []
    mockPrepare.mockImplementation(async () => {
      order.push('prepare')
      return makeAssistance()
    })
    mockAnalyze.mockImplementation(async () => {
      order.push('analyze')
      return makeAnalysis()
    })

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await screen.findByText('Garantia ativa')
    await waitFor(() => expect(order).toEqual(['prepare', 'analyze']))
    expect(mockPrepare).toHaveBeenCalledTimes(1)
    expect(mockAnalyze).toHaveBeenCalledTimes(1)
    // Mesmo problema trimado é reaproveitado.
    expect(mockAnalyze).toHaveBeenCalledWith(PURCHASE_ID, 'Máquina não centrifuga')
  })

  it('mostra o estado de análise em andamento', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())

    let resolveAnalyze: ((value: AssistanceAnalysis) => void) | undefined
    mockAnalyze.mockImplementation(
      () =>
        new Promise<AssistanceAnalysis>((resolve) => {
          resolveAnalyze = resolve
        }),
    )

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    expect(await screen.findByText('Analisando seu problema...')).toBeInTheDocument()

    resolveAnalyze?.(makeAnalysis())
    await screen.findByText('Resumo')
  })

  it('renderiza todos os campos da análise retornada', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockResolvedValue(makeAnalysis())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await screen.findByText('Resumo')
    expect(screen.getByText('A centrífuga pode estar travada.')).toBeInTheDocument()
    expect(screen.getByText('Possíveis causas')).toBeInTheDocument()
    expect(screen.getByText('Objeto preso no tambor')).toBeInTheDocument()
    expect(screen.getByText('Correia solta')).toBeInTheDocument()
    expect(screen.getByText('O que fazer agora')).toBeInTheDocument()
    expect(
      screen.getByText('Verifique o tambor e chame a assistência técnica.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Atenção')).toBeInTheDocument()
    expect(
      screen.getByText('Desligue da tomada antes de qualquer verificação.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sobre sua garantia')).toBeInTheDocument()
    expect(
      screen.getByText('O reparo é coberto pela garantia vigente.'),
    ).toBeInTheDocument()
  })
})

// -------------------------------------------------------------------------
// 6) requiredDocuments
// -------------------------------------------------------------------------
describe('documentos que podem ser solicitados', () => {
  it('exibe a seção com todos os itens retornados', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockResolvedValue(
      makeAnalysis({ requiredDocuments: ['Nota fiscal', 'Comprovante de compra'] }),
    )

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    const label = await screen.findByText('Documentos que podem ser solicitados')
    const field = label.closest('div') as HTMLElement
    const list = within(field).getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(list).getByText('Nota fiscal')).toBeInTheDocument()
    expect(within(list).getByText('Comprovante de compra')).toBeInTheDocument()
  })

  it('não exibe a seção quando a lista está vazia', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockResolvedValue(makeAnalysis({ requiredDocuments: [] }))

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await screen.findByText('Resumo')
    expect(
      screen.queryByText('Documentos que podem ser solicitados'),
    ).not.toBeInTheDocument()
  })
})

// -------------------------------------------------------------------------
// 7) Erro na preparação
// -------------------------------------------------------------------------
describe('erro na preparação', () => {
  it('mostra erro amigável e NÃO chama /analyze', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockRejectedValue(new ApiError('boom', 500, 'INTERNAL_ERROR'))

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    expect(
      await screen.findByText('Não foi possível verificar a garantia. Tente novamente.'),
    ).toBeInTheDocument()
    expect(mockAnalyze).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('erro 403 mostra a mensagem de acesso negado', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockRejectedValue(
      new ApiError('forbidden', 403, 'PURCHASE_ACCESS_DENIED'),
    )

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    expect(
      await screen.findByText('Você não tem acesso a esta compra.'),
    ).toBeInTheDocument()
  })

  it('401 na preparação chama onAuthError e não mostra erro inline', async () => {
    const onAuthError = vi.fn()
    const { user, getField, submit } = renderSection(onAuthError)
    mockPrepare.mockRejectedValue(new AuthenticationError())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await waitFor(() => expect(onAuthError).toHaveBeenCalledTimes(1))
    expect(mockAnalyze).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('401 na análise chama onAuthError', async () => {
    const onAuthError = vi.fn()
    const { user, getField, submit } = renderSection(onAuthError)
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockRejectedValue(new AuthenticationError())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await screen.findByText('Garantia ativa')
    await waitFor(() => expect(onAuthError).toHaveBeenCalledTimes(1))
  })
})

// -------------------------------------------------------------------------
// 8) Erro na análise
// -------------------------------------------------------------------------
describe('erro na análise', () => {
  it('mantém o status da garantia e mostra o erro da análise', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockRejectedValue(new ApiError('boom', 500, 'INTERNAL_ERROR'))

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    // Resultado da preparação continua visível.
    expect(
      await screen.findByRole('heading', { name: 'Garantia ativa' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(
        'Não foi possível gerar a orientação agora. Verifique sua conexão e tente novamente.',
      ),
    ).toBeInTheDocument()
    // Título da área de IA e problema informado permanecem.
    expect(screen.getByText('Orientação para o seu problema')).toBeInTheDocument()
    expect(screen.getByText('A máquina não centrifuga')).toBeInTheDocument()
  })
})

// -------------------------------------------------------------------------
// 9) Retry
// -------------------------------------------------------------------------
describe('retry', () => {
  it('retry da preparação repete o fluxo completo (/assistance → /analyze)', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockRejectedValueOnce(new ApiError('boom', 500, 'INTERNAL_ERROR'))
    mockPrepare.mockResolvedValueOnce(makeAssistance())
    mockAnalyze.mockResolvedValue(makeAnalysis())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await screen.findByText('Não foi possível verificar a garantia. Tente novamente.')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await screen.findByRole('heading', { name: 'Garantia ativa' })
    await waitFor(() => expect(mockAnalyze).toHaveBeenCalledTimes(1))
    expect(mockPrepare).toHaveBeenCalledTimes(2)
    expect(mockAnalyze).toHaveBeenCalledWith(PURCHASE_ID, 'Máquina não centrifuga')
  })

  it('retry da análise chama SOMENTE /analyze (não repete /assistance)', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockRejectedValueOnce(new ApiError('boom', 500, 'INTERNAL_ERROR'))
    mockAnalyze.mockResolvedValueOnce(makeAnalysis())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await screen.findByText(
      'Não foi possível gerar a orientação agora. Verifique sua conexão e tente novamente.',
    )
    expect(mockPrepare).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await screen.findByText('Resumo')
    expect(mockAnalyze).toHaveBeenCalledTimes(2)
    // A preparação NÃO é repetida no retry da análise.
    expect(mockPrepare).toHaveBeenCalledTimes(1)
  })
})

// -------------------------------------------------------------------------
// 10) Nova solicitação
// -------------------------------------------------------------------------
describe('nova solicitação', () => {
  it('volta ao formulário inicial sem fazer nova chamada de API', async () => {
    const { user, getField, submit } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockResolvedValue(makeAnalysis())

    await user.type(getField(), 'Máquina não centrifuga')
    await user.click(submit())

    await screen.findByText('Resumo')
    expect(mockPrepare).toHaveBeenCalledTimes(1)
    expect(mockAnalyze).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Nova solicitação' }))

    // Formulário volta e resultado anterior desaparece.
    expect(screen.getByLabelText('Descreva o problema')).toHaveValue('')
    expect(screen.queryByText('Resumo')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Garantia ativa' }),
    ).not.toBeInTheDocument()
    // Nenhuma chamada nova por apenas clicar.
    expect(mockPrepare).toHaveBeenCalledTimes(1)
    expect(mockAnalyze).toHaveBeenCalledTimes(1)
  })
})

// -------------------------------------------------------------------------
// 12) Chamadas duplicadas (double submit)
// -------------------------------------------------------------------------
describe('proteção contra chamadas duplicadas', () => {
  it('duplo clique rápido gera apenas 1 /assistance e 1 /analyze', async () => {
    const { user, getField } = renderSection()
    mockPrepare.mockResolvedValue(makeAssistance())
    mockAnalyze.mockResolvedValue(makeAnalysis())

    await user.type(getField(), 'Máquina não centrifuga')

    const button = screen.getByRole('button', { name: 'Solicitar assistência' })
    // Dois disparos no mesmo tick — a guarda síncrona deve conter o segundo.
    await Promise.all([user.click(button), user.click(button)])

    await screen.findByRole('heading', { name: 'Garantia ativa' })
    await waitFor(() => expect(mockAnalyze).toHaveBeenCalledTimes(1))
    expect(mockPrepare).toHaveBeenCalledTimes(1)
    expect(mockAnalyze).toHaveBeenCalledTimes(1)
  })
})
