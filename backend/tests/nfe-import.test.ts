// Integration tests for the NF-e XML import endpoint:
//   POST /nfe/import
//
// Real multipart/form-data requests are sent through the app. The endpoint
// receives, validates and parses the XML in memory — nothing is persisted (no
// purchase, warranty or file), so no storage cleanup is needed here.
//
// All fixtures below are fictional (fake CNPJ, fake access key, fake products).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

// ---- Fixture builders (dados 100% fictícios) -------------------------------

interface ItemOverrides {
  code?: string;
  description?: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  totalPrice?: string;
  ncm?: string | null;
}

const itemXml = (item: ItemOverrides = {}, nItem = 1) => `
      <det nItem="${nItem}">
        <prod>
          <cProd>${item.code ?? `PROD-${nItem}`}</cProd>
          <xProd>${item.description ?? `Produto Fictício ${nItem}`}</xProd>
          <NCM>${item.ncm ?? '85171200'}</NCM>
          <qCom>${item.quantity ?? '1.0000'}</qCom>
          <uCom>${item.unit ?? 'UN'}</uCom>
          <vUnCom>${item.unitPrice ?? '100.00'}</vUnCom>
          <vProd>${item.totalPrice ?? '100.00'}</vProd>
        </prod>
      </det>`;

// Uma NF-e fictícia, mas realista: envia `total` (vNF) e uma lista de itens.
const nfeXml = ({ items }: { items: ItemOverrides[] } = { items: [{}] }) => {
  const itemBlocks = items.map((item, index) => itemXml(item, index + 1)).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
 <NFe>
    <infNFe Id="NFe35200114200166000187550010000011000010" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <natOp>VENDA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>110</nNF>
        <dhEmi>2026-02-10T14:35:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>14200166000187</CNPJ>
        <xNome>Empresa Fictícia Exemplo LTDA</xNome>
        <xFant>Fictícia Exemplo</xFant>
      </emit>
      <dest>
        <CPF>12345678909</CPF>
        <xNome>Consumidor Fictício</xNome>
      </dest>${itemBlocks}
      <total>
        <ICMSTot>
          <vNF>100.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
 </NFe>
 <protNFe versao="4.00">
    <infProt>
      <chNFe>35200114200166000187550010000011000010</chNFe>
      <cStat>100</cStat>
    </infProt>
 </protNFe>
</nfeProc>`;
};

// Mantém apenas a compatibilidade dos testes de validação de arquivo, que só
// precisam de um XML bem formado.
const validXml = () => nfeXml();

interface UploadOptions {
  buffer?: Buffer;
  filename?: string;
  mimetype?: string;
  includeFile?: boolean;
}

const importNfe = (token: string | null, options: UploadOptions = {}) => {
  const {
    buffer = Buffer.from(validXml(), 'utf8'),
    filename = 'nota-fiscal.xml',
    mimetype = 'application/xml',
    includeFile = true,
  } = options;

  let request = api().post('/nfe/import');

  if (token) request = request.set('Authorization', `Bearer ${token}`);
  if (includeFile) request = request.attach('file', buffer, { filename, contentType: mimetype });

  return request;
};

describe('POST /nfe/import', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  // -------------------------------------------------------------------------
  // Sucesso
  // -------------------------------------------------------------------------
  describe('upload válido', () => {
    it('usuário autenticado envia XML válido e recebe 200 com a mensagem', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('XML da NF-e processado com sucesso');
      expect(response.body.invoice).toBeDefined();
    });

    it('aceita XML com mimetype text/xml', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, { mimetype: 'text/xml' });

      expect(response.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Autenticação
  // -------------------------------------------------------------------------
  describe('autenticação', () => {
    it('rejeita usuário não autenticado com 401', async () => {
      const response = await importNfe(null);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('rejeita token inválido com 401', async () => {
      const response = await importNfe('token-invalido');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
    });
  });

  // -------------------------------------------------------------------------
  // Validação de entrada
  // -------------------------------------------------------------------------
  describe('validação de entrada', () => {
    it('rejeita requisição sem arquivo com 400 NFE_FILE_REQUIRED', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, { includeFile: false });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('NFE_FILE_REQUIRED');
    });

    it('rejeita extensão inválida com 400 INVALID_NFE_TYPE', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from(validXml(), 'utf8'),
        filename: 'nota.txt',
        mimetype: 'text/plain',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NFE_TYPE');
    });

    it('rejeita extensão inválida mesmo com MIME de XML', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from(validXml(), 'utf8'),
        filename: 'nota.pdf',
        mimetype: 'application/xml',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NFE_TYPE');
    });

    it('rejeita arquivo vazio com 400 EMPTY_NFE_FILE', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, { buffer: Buffer.alloc(0) });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('EMPTY_NFE_FILE');
    });

    it('rejeita conteúdo que não é XML com 400 INVALID_NFE_CONTENT', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from('isto nao e um xml', 'utf8'),
        filename: 'nota.xml',
        mimetype: 'application/xml',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NFE_CONTENT');
    });

    it('rejeita conteúdo não cumprindo extensão de XML mesmo com extensão .xml', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from('{"nota": "fiscal"}', 'utf8'),
        filename: 'nota.xml',
        mimetype: 'application/xml',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NFE_CONTENT');
    });

    it('rejeita XML malformado (tag não fechada) com 400 INVALID_NFE_CONTENT', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from('<nfeProc><NFe><infNFe></nfeProc>', 'utf8'),
        filename: 'quebrado.xml',
        mimetype: 'application/xml',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NFE_CONTENT');
    });

    it('rejeita XML malformado (fechamento fora de ordem)', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from('<a><b></a></b>', 'utf8'),
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NFE_CONTENT');
    });

    it('rejeita arquivo acima de 5 MB com 400 NFE_TOO_LARGE', async () => {
      const { token } = await createUserWithToken();

      // 5 MB + 1 byte, começando como XML: o tamanho é barrado pelo multer antes
      // de qualquer validação de conteúdo.
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
      oversized.write('<nfeProc>', 0, 'utf8');

      const response = await importNfe(token, {
        buffer: oversized,
        filename: 'enorme.xml',
        mimetype: 'application/xml',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('NFE_TOO_LARGE');
    });
  });

  // -------------------------------------------------------------------------
  // Extração dos dados da NF-e
  // -------------------------------------------------------------------------
  describe('extração dos dados da NF-e', () => {
    it('extrai chave, número, série e data de emissão', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token);

      expect(response.status).toBe(200);
      expect(response.body.invoice).toMatchObject({
        accessKey: '35200114200166000187550010000011000010',
        number: '110',
        series: '1',
        issuedAt: '2026-02-10T14:35:00-03:00',
      });
    });

    it('extrai o emitente (razão social, nome fantasia e CNPJ)', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token);

      expect(response.body.invoice.issuer).toEqual({
        name: 'Empresa Fictícia Exemplo LTDA',
        tradeName: 'Fictícia Exemplo',
        cnpj: '14200166000187',
      });
    });

    it('extrai o valor total da NF-e como número', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token);

      expect(response.body.invoice.total).toBe(100);
    });

    it('NF-e com um produto: extrai todos os campos do item', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from(
          nfeXml({
            items: [
              {
                code: 'SKU-001',
                description: 'Fone de ouvido fictício',
                quantity: '2.0000',
                unit: 'UN',
                unitPrice: '649.95',
                totalPrice: '1299.90',
                ncm: '85183000',
              },
            ],
          }),
          'utf8',
        ),
      });

      expect(response.status).toBe(200);
      expect(response.body.invoice.items).toHaveLength(1);
      expect(response.body.invoice.items[0]).toEqual({
        code: 'SKU-001',
        description: 'Fone de ouvido fictício',
        quantity: 2,
        unit: 'UN',
        unitPrice: 649.95,
        totalPrice: 1299.9,
        ncm: '85183000',
      });
    });

    it('NF-e com vários produtos: extrai todos os itens, na ordem', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from(
          nfeXml({
            items: [
              { code: 'A', description: 'Item A', quantity: '1.0000', totalPrice: '10.00' },
              { code: 'B', description: 'Item B', quantity: '3.0000', totalPrice: '30.00' },
              { code: 'C', description: 'Item C', quantity: '5.0000', totalPrice: '50.00' },
            ],
          }),
          'utf8',
        ),
      });

      expect(response.status).toBe(200);
      const items = response.body.invoice.items;
      expect(items).toHaveLength(3);
      expect(items.map((item: { code: string }) => item.code)).toEqual(['A', 'B', 'C']);
      expect(items[1]).toMatchObject({ code: 'B', quantity: 3, totalPrice: 30 });
    });

    it('valores decimais e quantidades preservam precisão (string → number)', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from(
          nfeXml({
            items: [{ quantity: '0.5000', unitPrice: '19.99', totalPrice: '9.995' }],
          }),
          'utf8',
        ),
      });

      expect(response.body.invoice.items[0]).toMatchObject({
        quantity: 0.5,
        unitPrice: 19.99,
        totalPrice: 9.995,
      });
    });

    it('trata campos opcionais ausentes (nome fantasia, NCM e chave)', async () => {
      const { token } = await createUserWithToken();

      // Sem <xFant>, sem <NCM> e sem o atributo Id da infNFe.
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
 <infNFe versao="4.00">
    <ide>
      <serie>9</serie>
      <nNF>42</nNF>
      <dhEmi>2026-03-01T10:00:00-03:00</dhEmi>
    </ide>
    <emit>
      <CNPJ>00000191</CNPJ>
      <xNome>Fornecedor Fictício ME</xNome>
    </emit>
    <det nItem="1">
      <prod>
        <cProd>X1</cProd>
        <xProd>Item sem NCM</xProd>
        <qCom>1.0000</qCom>
        <uCom>CX</uCom>
        <vUnCom>25.00</vUnCom>
        <vProd>25.00</vProd>
      </prod>
    </det>
    <total><ICMSTot><vNF>25.00</vNF></ICMSTot></total>
 </infNFe>
</NFe>`;

      const response = await importNfe(token, { buffer: Buffer.from(xml, 'utf8') });

      expect(response.status).toBe(200);
      expect(response.body.invoice).toMatchObject({
        accessKey: null,
        number: '42',
        series: '9',
      });
      expect(response.body.invoice.issuer.tradeName).toBeNull();
      expect(response.body.invoice.items[0].ncm).toBeNull();
    });

    it('aceita NF-e sem nfeProc (raiz NFe)', async () => {
      const { token } = await createUserWithToken();
      const xml = nfeXml()
        .replace(/<\/?nfeProc[^>]*>/g, '')
        .replace(/<protNFe[\s\S]*?<\/protNFe>/, '');

      const response = await importNfe(token, { buffer: Buffer.from(xml, 'utf8') });

      expect(response.status).toBe(200);
      expect(response.body.invoice.number).toBe('110');
    });

    it('rejeita XML válido que não é uma NF-e suportada com UNSUPPORTED_NFE_DOCUMENT', async () => {
      const { token } = await createUserWithToken();

      const response = await importNfe(token, {
        buffer: Buffer.from('<pedido><item>um</item></pedido>', 'utf8'),
        filename: 'pedido.xml',
        mimetype: 'application/xml',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UNSUPPORTED_NFE_DOCUMENT');
    });

    it('rejeita NF-e sem itens (det) com INVALID_NFE_DATA', async () => {
      const { token } = await createUserWithToken();
      const xml = nfeXml().replace(/<det[\s\S]*?<\/det>/g, '');

      const response = await importNfe(token, { buffer: Buffer.from(xml, 'utf8') });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NFE_DATA');
    });

    it('rejeita NF-e com valor total inválido (não numérico) com INVALID_NFE_DATA', async () => {
      const { token } = await createUserWithToken();
      const xml = nfeXml().replace('<vNF>100.00</vNF>', '<vNF>abc</vNF>');

      const response = await importNfe(token, { buffer: Buffer.from(xml, 'utf8') });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NFE_DATA');
    });

    it('não retorna dados persistidos: nenhuma compra é criada', async () => {
      const { token } = await createUserWithToken();

      await importNfe(token);

      // O endpoint não cria Purchase nem Warranty (nenhuma persistência).
      const purchases = await testPrisma.purchase.count();
      const warranties = await testPrisma.warranty.count();
      expect(purchases).toBe(0);
      expect(warranties).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Segurança do parsing (XXE)
  // -------------------------------------------------------------------------
  describe('segurança do parsing', () => {
    it('rejeita XML com DOCTYPE/ENTITY externo (anti-XXE)', async () => {
      const { token } = await createUserWithToken();
      const xxe = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<nfeProc><NFe><infNFe><ide><nNF>&xxe;</nNF></ide></infNFe></NFe></nfeProc>`;

      const response = await importNfe(token, { buffer: Buffer.from(xxe, 'utf8') });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NFE_CONTENT');
    });
  });
});
