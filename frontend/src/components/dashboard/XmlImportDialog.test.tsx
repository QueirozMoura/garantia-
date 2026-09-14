// Testes do fluxo "Importar XML / NF-e" (XmlImportDialog).
//
// Executamos o componente REAL e mockamos apenas `importNfeXml` de
// src/lib/api.ts (sem request real, sem backend). Erros usam as classes REAIS
// `ApiError`/`AuthenticationError` para o componente exercitar seu tratamento.
// Nenhum endpoint de purchases é chamado nesta etapa — garantimos isso ao
// mockar o módulo e verificar que apenas `importNfeXml` foi invocado.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApiError, importNfeXml } from '../../lib/api.ts'
import type { NfeImportInvoice } from '../../types/nfe-import.ts'
import { XmlImportDialog } from './XmlImportDialog.tsx'

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api.ts')>()
  return {
    ...actual,
    importNfeXml: vi.fn(),
  }
})

const mockImport = vi.mocked(importNfeXml)

const makeInvoice = (overrides: Partial<NfeImportInvoice> = {}): NfeImportInvoice => ({
  accessKey: '35200114200166000187550010000011000010',
  number: '110',
  series: '1',
  issuedAt: '2026-02-10T14:35:00-03:00',
  issuer: {
    name: 'Empresa Fictícia Exemplo LTDA',
    tradeName: 'Fictícia Exemplo',
    cnpj: '14200166000187',
  },
  total: 1389.6,
  items: [
    {
      code: 'SKU-001',
      description: 'Fone de ouvido fictício',
      quantity: 2,
      unit: 'UN',
      unitPrice: 649.95,
      totalPrice: 1299.9,
      ncm: '85183000',
    },
    {
      code: 'SKU-002',
      description: 'Cabo USB fictício',
      quantity: 3,
      unit: 'PC',
      unitPrice: 29.9,
      totalPrice: 89.7,
      ncm: '85444200',
    },
  ],
  ...overrides,
})

/** Cria um File .xml fictício com o tamanho informado. */
const xmlFile = (name = 'nota-fiscal.xml', size?: number): File => {
  const file = new File(['<xml/>'], name, { type: 'application/xml' })
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

describe('XmlImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const setup = () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<XmlImportDialog onClose={onClose} />)
    return { user, onClose }
  }

  // 1. Modal abre (renderizado) com foco e aria corretos
  it('renderiza o modal com título acessível e CTA de seleção', () => {
    setup()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'xml-import-title')
    expect(
      screen.getByRole('heading', { name: 'Importar XML / NF-e' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Selecionar arquivo XML' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar XML' })).toBeDisabled()
  })

  // 2. Seleção de XML válido exibe o arquivo e habilita o envio
  it('seleciona um XML válido e habilita o envio', async () => {
    const { user } = setup()

    const input = screen.getByLabelText('Selecionar arquivo XML da NF-e')
    await user.upload(input, xmlFile('nota-fiscal.xml', 2048))

    expect(await screen.findByText('nota-fiscal.xml')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar XML' })).toBeEnabled()
  })

  // 3. Arquivo inválido (não .xml) não é enviado e mostra mensagem clara
  it('não envia arquivo com extensão inválida e mostra mensagem', async () => {
    const { user } = setup()

    const input = screen.getByLabelText(
      'Selecionar arquivo XML da NF-e',
    ) as HTMLInputElement
    // O atributo `accept` filtra o seletor no navegador, mas arrastar/soltar (ou
    // um input sem accept) pode entregar outro tipo — validamos isso aqui.
    input.accept = ''
    await user.upload(input, new File(['x'], 'nota.pdf', { type: 'application/pdf' }))

    expect(
      await screen.findByText('Selecione um arquivo XML (.xml).'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar XML' })).toBeDisabled()
    expect(mockImport).not.toHaveBeenCalled()
  })

  // 4. Arquivo acima de 5 MB não é enviado
  it('não envia arquivo acima de 5 MB e mostra mensagem', async () => {
    const { user } = setup()

    const input = screen.getByLabelText('Selecionar arquivo XML da NF-e')
    await user.upload(input, xmlFile('gigante.xml', 5 * 1024 * 1024 + 1))

    expect(
      await screen.findByText('O arquivo deve ter no máximo 5 MB.'),
    ).toBeInTheDocument()
    expect(mockImport).not.toHaveBeenCalled()
  })

  // 5. Estado de loading durante o upload
  it('mostra estado de envio enquanto a requisição está em andamento', async () => {
    const { user } = setup()

    let resolve!: (value: NfeImportInvoice) => void
    mockImport.mockImplementation(
      () =>
        new Promise<NfeImportInvoice>((r) => {
          resolve = r
        }),
    )

    await user.upload(
      screen.getByLabelText('Selecionar arquivo XML da NF-e'),
      xmlFile('nota-fiscal.xml', 1024),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar XML' }))

    expect(await screen.findByText('Enviando...')).toBeInTheDocument()
    expect(screen.getByText('Processando o XML...')).toBeInTheDocument()
    // Durante o envio, fechar/cancelar ficam bloqueados.
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()

    resolve(makeInvoice())
  })

  // 6. Sucesso exibe os dados retornados pela API
  it('exibe a prévia com os dados retornados pela API no sucesso', async () => {
    const { user } = setup()
    mockImport.mockResolvedValue(makeInvoice())

    await user.upload(
      screen.getByLabelText('Selecionar arquivo XML da NF-e'),
      xmlFile('nota-fiscal.xml', 1024),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar XML' }))

    expect(await screen.findByText('NF-e importada')).toBeInTheDocument()
    // Dados da nota
    expect(screen.getByText('Empresa Fictícia Exemplo LTDA')).toBeInTheDocument()
    expect(screen.getByText('Fictícia Exemplo')).toBeInTheDocument()
    expect(screen.getByText('14200166000187')).toBeInTheDocument()
    expect(screen.getByText('110 · Série 1')).toBeInTheDocument()
    expect(screen.getByText('10/02/2026')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.389,60')).toBeInTheDocument()
    // Produtos
    expect(screen.getByText('Fone de ouvido fictício')).toBeInTheDocument()
    expect(screen.getByText('Cabo USB fictício')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.299,90')).toBeInTheDocument()
    expect(screen.getByText('R$ 89,70')).toBeInTheDocument()

    expect(mockImport).toHaveBeenCalledTimes(1)
    expect(mockImport).toHaveBeenCalledWith(expect.any(File))
  })

  // 6b. Campos opcionais ausentes (tradeName/ncm null, sem série)
  it('omite campos opcionais ausentes na prévia', async () => {
    const { user } = setup()
    mockImport.mockResolvedValue(
      makeInvoice({
        series: '',
        issuer: { name: 'Fornecedor Fictício ME', tradeName: null, cnpj: '00000191' },
        items: [
          {
            code: '',
            description: 'Item sem NCM',
            quantity: 1,
            unit: 'CX',
            unitPrice: 25,
            totalPrice: 25,
            ncm: null,
          },
        ],
      }),
    )

    await user.upload(
      screen.getByLabelText('Selecionar arquivo XML da NF-e'),
      xmlFile('nota.xml', 512),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar XML' }))

    expect(await screen.findByText('Fornecedor Fictício ME')).toBeInTheDocument()
    // Sem série: mostra só o número.
    expect(screen.getByText('110')).toBeInTheDocument()
    // Nenhum rótulo de NCM (o item se chama "Item sem NCM", então buscamos o
    // prefixo "NCM " que só apareceria quando o campo existisse).
    expect(screen.queryByText(/· NCM /)).not.toBeInTheDocument()
    expect(screen.queryByText('Fictícia Exemplo')).not.toBeInTheDocument()
  })

  // 7. Erro INVALID_NFE_CONTENT → mensagem amigável
  it('mostra mensagem amigável para INVALID_NFE_CONTENT', async () => {
    const { user } = setup()
    mockImport.mockRejectedValue(
      new ApiError('File content is not a valid XML', 400, 'INVALID_NFE_CONTENT'),
    )

    await user.upload(
      screen.getByLabelText('Selecionar arquivo XML da NF-e'),
      xmlFile('quebrado.xml', 512),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar XML' }))

    expect(
      await screen.findByText(
        'Não conseguimos ler este arquivo. Verifique se é um XML válido.',
      ),
    ).toBeInTheDocument()
    // Não exibe o código técnico.
    expect(screen.queryByText('INVALID_NFE_CONTENT')).not.toBeInTheDocument()
  })

  // 8. Erro UNSUPPORTED_NFE_DOCUMENT → mensagem amigável
  it('mostra mensagem amigável para UNSUPPORTED_NFE_DOCUMENT', async () => {
    const { user } = setup()
    mockImport.mockRejectedValue(
      new ApiError(
        'The document does not look like a supported NF-e',
        400,
        'UNSUPPORTED_NFE_DOCUMENT',
      ),
    )

    await user.upload(
      screen.getByLabelText('Selecionar arquivo XML da NF-e'),
      xmlFile('pedido.xml', 512),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar XML' }))

    expect(
      await screen.findByText(
        'O arquivo XML é válido, mas não foi reconhecido como uma NF-e compatível.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('UNSUPPORTED_NFE_DOCUMENT')).not.toBeInTheDocument()
  })

  // 9. Erro genérico (5xx) → mensagem genérica amigável
  it('mostra mensagem genérica para erro de servidor', async () => {
    const { user } = setup()
    mockImport.mockRejectedValue(
      new ApiError('Something went wrong', 500, 'INTERNAL_ERROR'),
    )

    await user.upload(
      screen.getByLabelText('Selecionar arquivo XML da NF-e'),
      xmlFile('nota.xml', 512),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar XML' }))

    expect(
      await screen.findByText('Não foi possível importar a NF-e agora. Tente novamente.'),
    ).toBeInTheDocument()
  })

  // 10. Fechar/cancelar o modal
  it('fecha o modal pelo botão Cancelar', async () => {
    const { user, onClose } = setup()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fecha o modal pela tecla Escape', async () => {
    const { user, onClose } = setup()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fecha o modal pelo botão de fechar (X)', async () => {
    const { user, onClose } = setup()

    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('após o sucesso, permite fechar pela ação "Fechar"', async () => {
    const { user, onClose } = setup()
    mockImport.mockResolvedValue(makeInvoice())

    await user.upload(
      screen.getByLabelText('Selecionar arquivo XML da NF-e'),
      xmlFile('nota.xml', 512),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar XML' }))
    await screen.findByText('NF-e importada')

    const dialog = screen.getByRole('dialog')
    // O X do cabeçalho também se chama "Fechar" (aria-label); selecionamos o
    // botão de ação de rodapé pelo seu texto visível.
    const closeAction = within(dialog)
      .getAllByRole('button', { name: 'Fechar' })
      .find((button) => button.textContent?.trim() === 'Fechar')
    expect(closeAction).toBeDefined()
    await user.click(closeAction as HTMLElement)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 11. Nenhum endpoint de purchases é chamado nesta etapa
  it('não chama nenhum endpoint de purchases (somente importNfeXml)', async () => {
    const api = await import('../../lib/api.ts')
    const createPurchase = vi.spyOn(api, 'createPurchase')

    const { user } = setup()
    mockImport.mockResolvedValue(makeInvoice())

    await user.upload(
      screen.getByLabelText('Selecionar arquivo XML da NF-e'),
      xmlFile('nota.xml', 512),
    )
    await user.click(screen.getByRole('button', { name: 'Enviar XML' }))
    await screen.findByText('NF-e importada')

    expect(mockImport).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(createPurchase).not.toHaveBeenCalled())
  })
})
