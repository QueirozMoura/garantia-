// Integration tests for the NF-e XML import endpoint:
//   POST /nfe/import
//
// Real multipart/form-data requests are sent through the app. This step only
// receives and validates the XML — nothing is persisted (no purchase, warranty
// or file), so no storage cleanup is needed here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase } from './helpers/db.js';

// A minimal, well-formed NF-e-like XML document.
const validXml = () =>
  `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
 <NFe>
    <infNFe Id="NFe35200614200166000187550010000011000010" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <natOp>VENDA</natOp>
      </ide>
      <emit>
        <CNPJ>14200166000187</CNPJ>
        <xNome>Empresa Exemplo LTDA</xNome>
      </emit>
    </infNFe>
 </NFe>
 <protNFe versao="4.00">
    <infProt>
      <chNFe>35200614200166000187550010000011000010</chNFe>
      <cStat>100</cStat>
    </infProt>
 </protNFe>
</nfeProc>`;

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
      expect(response.body).toEqual({
        message: 'XML da NF-e recebido e validado com sucesso',
      });
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
});
