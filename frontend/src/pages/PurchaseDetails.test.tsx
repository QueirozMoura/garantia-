// Testes do fluxo de Detalhes da compra (PurchaseDetails) e das ações
// diretamente relacionadas: edição (EditPurchase) e exclusão (dialog).
//
// Executamos os componentes REAIS e mockamos apenas as funções públicas de
// src/lib/api.ts (sem request real, sem backend, sem Gemini). As seções filhas
// (garantia, documentos, assistência) também chamam a API; mockamos suas funções
// para isolar o PurchaseDetails e garantir determinismo.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import {
  ApiError,
  AuthenticationError,
  getPurchase,
  updatePurchase,
  deletePurchase,
  getPurchaseWarranty,
  getPurchaseDocuments,
} from '../lib/api.ts'
import { AuthContext, type AuthContextValue } from '../contexts/auth-context.ts'
import type { AuthUser } from '../types/auth.ts'
import type { Purchase } from '../types/purchase.ts'
import type { Warranty } from '../types/warranty.ts'
import type { Document } from '../types/document.ts'
import { PurchaseDetails } from './PurchaseDetails.tsx'
import { EditPurchase } from './EditPurchase.tsx'

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.ts')>()
  return {
    ...actual,
    getPurchase: vi.fn(),
    updatePurchase: vi.fn(),
    deletePurchase: vi.fn(),
    getPurchaseWarranty: vi.fn(),
    getPurchaseDocuments: vi.fn(),
    // Seções de garantia/documentos são carregadas como filhas; seus endpoints
    // de escrita não são exercitados aqui.
    createPurchaseWarranty: vi.fn(),
    updatePurchaseWarranty: vi.fn(),
    deletePurchaseWarranty: vi.fn(),
    uploadPurchaseDocument: vi.fn(),
    deleteDocument: vi.fn(),
    getDocumentFile: vi.fn(),
    extractDocument: vi.fn(),
    confirmDocumentExtraction: vi.fn(),
    prepareAssistance: vi.fn(),
    analyzeAssistance: vi.fn(),
  }
})

const mockGetPurchase = vi.mocked(getPurchase)
const mockUpdatePurchase = vi.mocked(updatePurchase)
const mockDeletePurchase = vi.mocked(deletePurchase)
const mockGetWarranty = vi.mocked(getPurchaseWarranty)
const mockGetDocuments = vi.mocked(getPurchaseDocuments)

const PURCHASE_ID = 'purchase-42'

const makePurchase = (overrides: Partial<Purchase> = {}): Purchase => ({
  id: PURCHASE_ID,
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  serialNumber: 'SN-12345',
  store: 'Magazine Luiza',
  purchaseDate: '2026-01-15',
  price: '8749.90',
  category: 'Informática',
  warranty: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  ...overrides,
})

const makeWarranty = (overrides: Partial<Warranty> = {}): Warranty => ({
  id: 'warranty-1',
  purchaseId: PURCHASE_ID,
  durationMonths: 12,
  startDate: '2026-01-15T00:00:00.000Z',
  endDate: '2100-01-15T00:00:00.000Z',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  ...overrides,
})

const makeDocument = (overrides: Partial<Document> = {}): Document => ({
  id: 'doc-1',
  purchaseId: PURCHASE_ID,
  name: 'Comprovante da loja',
  fileName: 'nota.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  type: 'INVOICE',
  createdAt: '2026-01-16T00:00:00.000Z',
  updatedAt: '2026-01-16T00:00:00.000Z',
  ...overrides,
})

describe('PurchaseDetails', () => {
  let setUser: (user: AuthUser | null) => void
  beforeEach(() => {
    vi.clearAllMocks()
    setUser = vi.fn()
    // Estado padrão: sem garantia e sem documentos, para os testes da página.
    mockGetWarranty.mockResolvedValue(null)
    mockGetDocuments.mockResolvedValue([])
  })

  /** Renderiza PurchaseDetails na rota de detalhes dentro do MemoryRouter. */
  const renderDetails = (path = `/purchases/${PURCHASE_ID}`) => {
    const user = userEvent.setup()
    const authValue: AuthContextValue = {
      user: null,
      status: 'authenticated',
      isAuthenticated: true,
      isGuest: false,
      isLoading: false,
      logout: vi.fn(),
      setUser,
    }
    const utils = render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/purchases/:id" element={<PurchaseDetails />} />
            <Route
              path="/purchases/:id/edit"
              element={
                <div>
                  <span>EDIT_PAGE</span>
                  <EditPurchase />
                </div>
              }
            />
            <Route path="/purchases" element={<div>LIST_PAGE</div>} />
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    return { user, authValue, ...utils }
  }

  // -----------------------------------------------------------------------
  // 1) Carregamento / renderização
  // -----------------------------------------------------------------------
  describe('carregamento e dados', () => {
    it('chama getPurchase com o id da rota', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())

      renderDetails()

      await waitFor(() => expect(mockGetPurchase).toHaveBeenCalledWith(PURCHASE_ID))
      expect(mockGetPurchase).toHaveBeenCalledTimes(1)
    })

    it('mostra o skeleton durante o carregamento', () => {
      mockGetPurchase.mockReturnValue(new Promise(() => {}))

      renderDetails()

      expect(screen.getByLabelText('Carregando detalhes da compra')).toBeInTheDocument()
    })

    it('exibe os dados principais da compra', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())

      renderDetails()

      expect(
        await screen.findByRole('heading', { name: 'Detalhes da compra' }),
      ).toBeInTheDocument()
      // Nome do produto aparece no card do produto.
      expect(
        screen.getByRole('heading', { name: 'Notebook Dell XPS 15' }),
      ).toBeInTheDocument()
      // Marca e modelo juntos como subtítulo.
      expect(screen.getByText('Dell XPS 15 9530')).toBeInTheDocument()

      const info = screen
        .getByRole('heading', { name: 'Informações da compra' })
        .closest('section') as HTMLElement
      expect(within(info).getByText('R$ 8.749,90')).toBeInTheDocument()
      expect(within(info).getByText('15/01/2026')).toBeInTheDocument()
      expect(within(info).getByText('Informática')).toBeInTheDocument()
      expect(within(info).getByText('Magazine Luiza')).toBeInTheDocument()
      expect(within(info).getByText('SN-12345')).toBeInTheDocument()
    })

    it('não chama update/delete no mount', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())

      renderDetails()

      await screen.findByRole('heading', { name: 'Notebook Dell XPS 15' })
      expect(mockUpdatePurchase).not.toHaveBeenCalled()
      expect(mockDeletePurchase).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // 2) Erro de carregamento
  // -----------------------------------------------------------------------
  describe('erro de carregamento', () => {
    it('mostra o estado de erro quando a API falha', async () => {
      mockGetPurchase.mockRejectedValue(new ApiError('boom', 500, 'INTERNAL_ERROR'))

      renderDetails()

      expect(
        await screen.findByRole('heading', {
          name: 'Não foi possível carregar a compra',
        }),
      ).toBeInTheDocument()
      // Não há tela de sucesso falsa.
      expect(
        screen.queryByRole('heading', { name: 'Informações da compra' }),
      ).not.toBeInTheDocument()
    })

    it('o botão "Tentar novamente" refaz apenas o carregamento', async () => {
      mockGetPurchase.mockRejectedValueOnce(new ApiError('boom', 500, 'INTERNAL_ERROR'))
      mockGetPurchase.mockResolvedValueOnce(makePurchase())

      const { user } = renderDetails()

      await screen.findByRole('heading', { name: 'Não foi possível carregar a compra' })
      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      expect(
        await screen.findByRole('heading', { name: 'Notebook Dell XPS 15' }),
      ).toBeInTheDocument()
      expect(mockGetPurchase).toHaveBeenCalledTimes(2)
      expect(mockUpdatePurchase).not.toHaveBeenCalled()
      expect(mockDeletePurchase).not.toHaveBeenCalled()
    })

    it('404 mostra o estado "Compra não encontrada"', async () => {
      mockGetPurchase.mockRejectedValue(
        new ApiError('not found', 404, 'PURCHASE_NOT_FOUND'),
      )

      renderDetails()

      expect(
        await screen.findByRole('heading', { name: 'Compra não encontrada' }),
      ).toBeInTheDocument()
    })

    it('403 também mostra o estado "Compra não encontrada"', async () => {
      mockGetPurchase.mockRejectedValue(
        new ApiError('forbidden', 403, 'PURCHASE_ACCESS_DENIED'),
      )

      renderDetails()

      expect(
        await screen.findByRole('heading', { name: 'Compra não encontrada' }),
      ).toBeInTheDocument()
    })

    it('401 encerra a sessão (setUser) e navega para o login', async () => {
      mockGetPurchase.mockRejectedValue(new AuthenticationError())

      renderDetails()

      expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
      expect(setUser).toHaveBeenCalledWith(null)
    })
  })

  // -----------------------------------------------------------------------
  // 3) Garantia (seção filha integrada)
  // -----------------------------------------------------------------------
  describe('seção de garantia', () => {
    it('carrega a garantia uma única vez com o purchaseId da rota', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      mockGetWarranty.mockResolvedValue(makeWarranty())

      renderDetails()

      await screen.findByRole('heading', { name: 'Garantia' })
      await waitFor(() => expect(mockGetWarranty).toHaveBeenCalledWith(PURCHASE_ID))
      expect(mockGetWarranty).toHaveBeenCalledTimes(1)
    })

    it('compra com garantia mostra "Ativa" e os meses', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      mockGetWarranty.mockResolvedValue(makeWarranty())

      renderDetails()

      await screen.findByText('Ativa')
      expect(screen.getByText('12 meses')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    })

    it('compra sem garantia mostra o estado vazio', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      mockGetWarranty.mockResolvedValue(null)

      renderDetails()

      expect(
        await screen.findByText('Esta compra ainda não possui garantia'),
      ).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 4) Documentos (seção filha integrada)
  // -----------------------------------------------------------------------
  describe('seção de documentos', () => {
    it('carrega os documentos uma única vez e lista os existentes', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      mockGetDocuments.mockResolvedValue([makeDocument()])

      renderDetails()

      expect(await screen.findByText('Comprovante da loja')).toBeInTheDocument()
      await waitFor(() => expect(mockGetDocuments).toHaveBeenCalledWith(PURCHASE_ID))
      expect(mockGetDocuments).toHaveBeenCalledTimes(1)
    })

    it('sem documentos mostra o estado vazio', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      mockGetDocuments.mockResolvedValue([])

      renderDetails()

      expect(
        await screen.findByText('Esta compra ainda não possui documentos'),
      ).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 5) Assistência (integração)
  // -----------------------------------------------------------------------
  describe('seção de assistência (integração)', () => {
    it('a seção de assistência aparece na página de detalhes', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())

      renderDetails()

      expect(
        await screen.findByRole('heading', { name: 'Precisa de assistência?' }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Descreva o problema')).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 11) Exclusão
  // -----------------------------------------------------------------------
  describe('exclusão', () => {
    it('o botão excluir só aparece quando a compra carregou', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())

      renderDetails()

      expect(
        await screen.findByRole('button', { name: /Excluir compra/ }),
      ).toBeInTheDocument()
      // Abrir a página NÃO dispara DELETE.
      expect(mockDeletePurchase).not.toHaveBeenCalled()
    })

    it('clicar em excluir abre o diálogo de confirmação sem disparar DELETE', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      const { user } = renderDetails()

      await user.click(await screen.findByRole('button', { name: /Excluir compra/ }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Excluir compra?')).toBeInTheDocument()
      expect(mockDeletePurchase).not.toHaveBeenCalled()
    })

    it('cancelar a confirmação não chama DELETE e mantém a compra', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      const { user } = renderDetails()

      await user.click(await screen.findByRole('button', { name: /Excluir compra/ }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(mockDeletePurchase).not.toHaveBeenCalled()
      expect(
        screen.getByRole('heading', { name: 'Notebook Dell XPS 15' }),
      ).toBeInTheDocument()
    })

    it('confirmar chama DELETE uma vez com o purchaseId e navega para a lista', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      mockDeletePurchase.mockResolvedValue(undefined)
      const { user } = renderDetails()

      await user.click(await screen.findByRole('button', { name: /Excluir compra/ }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir compra' }))

      await waitFor(() => expect(mockDeletePurchase).toHaveBeenCalledWith(PURCHASE_ID))
      expect(mockDeletePurchase).toHaveBeenCalledTimes(1)
      // Navega para a lista de compras após o sucesso.
      expect(await screen.findByText('LIST_PAGE')).toBeInTheDocument()
    })

    it('erro no DELETE mantém o modal aberto com mensagem amigável', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      mockDeletePurchase.mockRejectedValue(new ApiError('boom', 500, 'INTERNAL_ERROR'))
      const { user } = renderDetails()

      await user.click(await screen.findByRole('button', { name: /Excluir compra/ }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir compra' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        'Não foi possível excluir a compra. Tente novamente.',
      )
      // O modal permanece aberto e a compra continua na tela.
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(mockDeletePurchase).toHaveBeenCalledTimes(1)
    })

    it('erro 403 no DELETE mostra a mensagem de permissão', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      mockDeletePurchase.mockRejectedValue(
        new ApiError('forbidden', 403, 'PURCHASE_ACCESS_DENIED'),
      )
      const { user } = renderDetails()

      await user.click(await screen.findByRole('button', { name: /Excluir compra/ }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir compra' }))

      expect(
        await screen.findByText('Você não tem permissão para excluir esta compra.'),
      ).toBeInTheDocument()
    })

    it('401 no DELETE encerra a sessão e vai para o login', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      mockDeletePurchase.mockRejectedValue(new AuthenticationError())
      const { user } = renderDetails()

      await user.click(await screen.findByRole('button', { name: /Excluir compra/ }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Excluir compra' }))

      expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
      expect(setUser).toHaveBeenCalledWith(null)
    })

    it('duplo clique em confirmar não dispara dois DELETEs', async () => {
      mockGetPurchase.mockResolvedValue(makePurchase())
      let resolveDelete: (() => void) | undefined
      mockDeletePurchase.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve
          }),
      )
      const { user } = renderDetails()

      await user.click(await screen.findByRole('button', { name: /Excluir compra/ }))
      const dialog = await screen.findByRole('dialog')
      const confirm = within(dialog).getByRole('button', { name: 'Excluir compra' })

      // Dois cliques no mesmo tick: a guarda `isDeleting` deve conter o segundo.
      await Promise.all([user.click(confirm), user.click(confirm)])

      expect(mockDeletePurchase).toHaveBeenCalledTimes(1)
      resolveDelete?.()
      await screen.findByText('LIST_PAGE')
    })
  })
})

// -------------------------------------------------------------------------
// 6) Edição (página EditPurchase, alcançada pela navegação dos detalhes)
// -------------------------------------------------------------------------
describe('edição da compra', () => {
  let setUser: (user: AuthUser | null) => void
  beforeEach(() => {
    vi.clearAllMocks()
    setUser = vi.fn()
    mockGetWarranty.mockResolvedValue(null)
    mockGetDocuments.mockResolvedValue([])
  })

  /** Renderiza a página de edição dentro do MemoryRouter. */
  const renderEdit = (path = `/purchases/${PURCHASE_ID}/edit`) => {
    const user = userEvent.setup()
    const authValue: AuthContextValue = {
      user: null,
      status: 'authenticated',
      isAuthenticated: true,
      isGuest: false,
      isLoading: false,
      logout: vi.fn(),
      setUser,
    }
    const utils = render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/purchases/:id/edit" element={<EditPurchase />} />
            <Route path="/purchases/:id" element={<div>DETAILS_PAGE</div>} />
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    return { user, ...utils }
  }

  it('preenche os campos com os valores atuais da compra', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())

    renderEdit()

    expect(
      await screen.findByRole('heading', { name: 'Editar compra' }),
    ).toBeInTheDocument()
    expect(mockGetPurchase).toHaveBeenCalledWith(PURCHASE_ID)
    expect(screen.getByLabelText(/Nome do produto/)).toHaveValue('Notebook Dell XPS 15')
    expect(screen.getByLabelText('Marca')).toHaveValue('Dell')
    expect(screen.getByLabelText('Modelo')).toHaveValue('XPS 15 9530')
    expect(screen.getByLabelText('Número de série')).toHaveValue('SN-12345')
    expect(screen.getByLabelText('Loja')).toHaveValue('Magazine Luiza')
    expect(screen.getByLabelText(/Data da compra/)).toHaveValue('2026-01-15')
    expect(screen.getByLabelText(/Preço/)).toHaveValue('8749.90')
    expect(screen.getByLabelText(/Categoria/)).toHaveValue('Informática')
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('não chama update no mount', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())

    renderEdit()

    await screen.findByRole('heading', { name: 'Editar compra' })
    expect(mockUpdatePurchase).not.toHaveBeenCalled()
  })

  it('salva com o purchaseId correto e apenas o payload esperado', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())
    mockUpdatePurchase.mockResolvedValue(
      makePurchase({ productName: 'Notebook Dell XPS 17' }),
    )

    const { user } = renderEdit()

    const nameField = await screen.findByLabelText(/Nome do produto/)
    await user.clear(nameField)
    await user.type(nameField, 'Notebook Dell XPS 17')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(mockUpdatePurchase).toHaveBeenCalledTimes(1))
    expect(mockUpdatePurchase).toHaveBeenCalledWith(PURCHASE_ID, {
      productName: 'Notebook Dell XPS 17',
      brand: 'Dell',
      model: 'XPS 15 9530',
      serialNumber: 'SN-12345',
      store: 'Magazine Luiza',
      purchaseDate: '2026-01-15',
      price: 8749.9,
      category: 'Informática',
    })
  })

  it('mostra loading durante o salvamento', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())
    let resolveUpdate: ((value: Purchase) => void) | undefined
    mockUpdatePurchase.mockImplementation(
      () =>
        new Promise<Purchase>((resolve) => {
          resolveUpdate = resolve
        }),
    )

    const { user } = renderEdit()

    await screen.findByRole('heading', { name: 'Editar compra' })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('button', { name: 'Salvando...' })).toBeDisabled()

    resolveUpdate?.(makePurchase())
    await screen.findByText('DETAILS_PAGE')
  })

  it('após o sucesso navega para os detalhes', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())
    mockUpdatePurchase.mockResolvedValue(makePurchase())

    const { user } = renderEdit()

    await screen.findByRole('heading', { name: 'Editar compra' })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('DETAILS_PAGE')).toBeInTheDocument()
    expect(mockUpdatePurchase).toHaveBeenCalledTimes(1)
  })

  // -----------------------------------------------------------------------
  // 7) Validação da edição
  // -----------------------------------------------------------------------
  it('nome vazio não chama update e mostra erro de validação', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())

    const { user } = renderEdit()

    const nameField = await screen.findByLabelText(/Nome do produto/)
    await user.clear(nameField)
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(screen.getByText('Informe o nome do produto.')).toBeInTheDocument()
    expect(mockUpdatePurchase).not.toHaveBeenCalled()
  })

  it('data vazia não chama update e mostra erro de validação', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())

    const { user } = renderEdit()

    const dateField = await screen.findByLabelText(/Data da compra/)
    // `type="date"` só aceita datas de calendário válidas ou vazio — o próprio
    // input sanitiza valores como "2026-13-40". Limpar cobre a validação real.
    fireEvent.change(dateField, { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(screen.getByText('Informe a data da compra.')).toBeInTheDocument()
    expect(mockUpdatePurchase).not.toHaveBeenCalled()
  })

  it('preço inválido não chama update', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())

    const { user } = renderEdit()

    const priceField = await screen.findByLabelText(/Preço/)
    await user.clear(priceField)
    await user.type(priceField, 'abc')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(screen.getByText('Informe um preço válido.')).toBeInTheDocument()
    expect(mockUpdatePurchase).not.toHaveBeenCalled()
  })

  it('usuário corrige a validação e consegue salvar', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())
    mockUpdatePurchase.mockResolvedValue(
      makePurchase({ productName: 'Produto corrigido' }),
    )

    const { user } = renderEdit()

    const nameField = await screen.findByLabelText(/Nome do produto/)
    await user.clear(nameField)
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(mockUpdatePurchase).not.toHaveBeenCalled()

    await user.type(nameField, 'Produto corrigido')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(mockUpdatePurchase).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('DETAILS_PAGE')).toBeInTheDocument()
  })

  // -----------------------------------------------------------------------
  // 8) Cancelar edição
  // -----------------------------------------------------------------------
  it('cancelar não envia alterações e volta para os detalhes', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())

    const { user } = renderEdit()

    const nameField = await screen.findByLabelText(/Nome do produto/)
    await user.clear(nameField)
    await user.type(nameField, 'Alteração não salva')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByText('DETAILS_PAGE')).toBeInTheDocument()
    expect(mockUpdatePurchase).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // 10) Erro no update
  // -----------------------------------------------------------------------
  it('erro no update mostra mensagem, não navega e mantém os valores digitados', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())
    mockUpdatePurchase.mockRejectedValue(new ApiError('boom', 500, 'INTERNAL_ERROR'))

    const { user } = renderEdit()

    const nameField = await screen.findByLabelText(/Nome do produto/)
    await user.clear(nameField)
    await user.type(nameField, 'Nome que falhou')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Não foi possível atualizar a compra. Tente novamente.',
    )
    // Continua no modo de edição, com os valores digitados preservados.
    expect(screen.queryByText('DETAILS_PAGE')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do produto/)).toHaveValue('Nome que falhou')
  })

  it('erro 400 no update mostra a mensagem de validação do backend', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())
    mockUpdatePurchase.mockRejectedValue(
      new ApiError('bad request', 400, 'VALIDATION_ERROR'),
    )

    const { user } = renderEdit()

    await screen.findByRole('heading', { name: 'Editar compra' })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Verifique os dados informados.')).toBeInTheDocument()
  })

  it('permite tentar novamente após um erro de update', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())
    mockUpdatePurchase.mockRejectedValueOnce(new ApiError('boom', 500, 'INTERNAL_ERROR'))
    mockUpdatePurchase.mockResolvedValueOnce(makePurchase())

    const { user } = renderEdit()

    await screen.findByRole('heading', { name: 'Editar compra' })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(mockUpdatePurchase).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('DETAILS_PAGE')).toBeInTheDocument()
  })

  it('401 no update encerra a sessão e vai para o login', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())
    mockUpdatePurchase.mockRejectedValue(new AuthenticationError())

    const { user } = renderEdit()

    await screen.findByRole('heading', { name: 'Editar compra' })
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
    expect(setUser).toHaveBeenCalledWith(null)
  })

  // -----------------------------------------------------------------------
  // 9) Double submit da edição
  // -----------------------------------------------------------------------
  it('duplo clique em salvar gera uma única chamada de update', async () => {
    mockGetPurchase.mockResolvedValue(makePurchase())
    let resolveUpdate: ((value: Purchase) => void) | undefined
    mockUpdatePurchase.mockImplementation(
      () =>
        new Promise<Purchase>((resolve) => {
          resolveUpdate = resolve
        }),
    )

    const { user } = renderEdit()

    await screen.findByRole('heading', { name: 'Editar compra' })
    const save = screen.getByRole('button', { name: 'Salvar alterações' })
    await Promise.all([user.click(save), user.click(save)])

    expect(mockUpdatePurchase).toHaveBeenCalledTimes(1)
    resolveUpdate?.(makePurchase())
    await screen.findByText('DETAILS_PAGE')
  })
})
