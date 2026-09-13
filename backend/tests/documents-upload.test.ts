// Integration tests for the private document upload endpoint:
//   POST /purchases/:purchaseId/documents
//
// Real multipart/form-data requests are sent through the app. Small, valid
// binaries (matching the magic-byte checks of the service) are generated in
// memory — no fixture files are added to the repository.
//
// The service writes real files under `backend/uploads` (path.resolve of cwd).
// Each created document records its `storagePath`, and the suite removes exactly
// those files in afterAll — never wiping the whole directory.
import { readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const uploadsDirectory = path.resolve(process.cwd(), 'uploads');

// --- Small valid binaries (only need to satisfy the magic-byte checks) -------

// "%PDF-" header + a minimal EOF marker.
const pdfBuffer = () => Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n', 'latin1');

// JPEG SOI marker FF D8 FF followed by a few bytes.
const jpegBuffer = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

// PNG 8-byte signature + some payload bytes.
const pngBuffer = () =>
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from('payload-bytes', 'latin1'),
  ]);

// Invalid content for the declared MIME types (should fail magic-byte checks).
const notAPdfBuffer = () => Buffer.from('this is definitely not a pdf', 'latin1');
const notAnImageBuffer = () => Buffer.from('this is definitely not an image', 'latin1');

// Tracks storagePath of every document created through the endpoint so the
// suite can delete exactly those files (and nothing else).
const createdStoragePaths = new Set<string>();

const trackStoragePaths = async () => {
  const documents = await testPrisma.document.findMany({ select: { storagePath: true } });
  for (const document of documents) createdStoragePaths.add(document.storagePath);
};

const createPurchase = async (userId: string, productName = 'Produto Upload') =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName,
      purchaseDate: new Date('2026-09-10T00:00:00.000Z'),
      price: '100.00',
      category: 'Eletrônicos',
    },
  });

interface UploadOptions {
  buffer?: Buffer;
  filename?: string;
  mimetype?: string;
  name?: string;
  type?: string;
  includeFile?: boolean;
  extraFields?: Record<string, string>;
}

const uploadDocument = (purchaseId: string, token: string, options: UploadOptions = {}) => {
  const {
    buffer = pdfBuffer(),
    filename = 'nota.pdf',
    mimetype = 'application/pdf',
    name = 'Nota fiscal',
    type = 'INVOICE',
    includeFile = true,
    extraFields = {},
  } = options;

  let request = api()
    .post(`/purchases/${purchaseId}/documents`)
    .set('Authorization', `Bearer ${token}`);

  if (includeFile) {
    request = request.attach('file', buffer, { filename, contentType: mimetype });
  }

  request = request.field('name', name).field('type', type);

  for (const [key, value] of Object.entries(extraFields)) {
    request = request.field(key, value);
  }

  return request;
};

const fileExists = async (relativePath: string) => {
  try {
    await stat(path.join(uploadsDirectory, relativePath));
    return true;
  } catch {
    return false;
  }
};

describe('POST /purchases/:purchaseId/documents', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    // Remove only the files created by this suite.
    for (const storagePath of createdStoragePaths) {
      await rm(path.join(uploadsDirectory, storagePath), { force: true }).catch(() => undefined);
    }
    await cleanDatabase();
    await disconnectDatabase();
  });

  // -------------------------------------------------------------------------
  // Uploads válidos
  // -------------------------------------------------------------------------
  describe('uploads válidos', () => {
    it('aceita PDF válido, persiste e permite recuperar pelo endpoint protegido', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      const buffer = pdfBuffer();

      const response = await uploadDocument(purchase.id, token, {
        buffer,
        filename: 'nota-fiscal.pdf',
        mimetype: 'application/pdf',
        name: 'Nota fiscal de setembro',
        type: 'INVOICE',
      });

      expect(response.status).toBe(201);
      const { document } = response.body;
      expect(document).toMatchObject({
        purchaseId: purchase.id,
        name: 'Nota fiscal de setembro',
        fileName: 'nota-fiscal.pdf',
        mimeType: 'application/pdf',
        size: buffer.length,
        type: 'INVOICE',
      });

      // Contrato público: não expõe storagePath nem campos internos.
      expect(document.storagePath).toBeUndefined();
      expect(document.userId).toBeUndefined();

      // Persistido no banco.
      const persisted = await testPrisma.document.findUnique({ where: { id: document.id } });
      expect(persisted).not.toBeNull();
      expect(persisted?.mimeType).toBe('application/pdf');

      // Arquivo armazenado com nome seguro e recuperável via endpoint protegido.
      expect(persisted?.storagePath).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      expect(await fileExists(persisted?.storagePath as string)).toBe(true);

      const download = await api()
        .get(`/documents/${document.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toContain('application/pdf');
      expect(download.body).toBeInstanceOf(Buffer);
      expect((download.body as Buffer).equals(buffer)).toBe(true);

      await trackStoragePaths();
    });

    it('aceita JPEG válido', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      const buffer = jpegBuffer();

      const response = await uploadDocument(purchase.id, token, {
        buffer,
        filename: 'foto.jpg',
        mimetype: 'image/jpeg',
        name: 'Foto da nota',
        type: 'RECEIPT',
      });

      expect(response.status).toBe(201);
      expect(response.body.document).toMatchObject({
        fileName: 'foto.jpg',
        mimeType: 'image/jpeg',
        size: buffer.length,
        type: 'RECEIPT',
      });
      await trackStoragePaths();
    });

    it('aceita PNG válido', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      const buffer = pngBuffer();

      const response = await uploadDocument(purchase.id, token, {
        buffer,
        filename: 'comprovante.png',
        mimetype: 'image/png',
        name: 'Comprovante',
        type: 'OTHER',
      });

      expect(response.status).toBe(201);
      expect(response.body.document).toMatchObject({
        fileName: 'comprovante.png',
        mimeType: 'image/png',
        size: buffer.length,
        type: 'OTHER',
      });
      await trackStoragePaths();
    });
  });

  // -------------------------------------------------------------------------
  // Validação de entrada
  // -------------------------------------------------------------------------
  describe('validação de entrada', () => {
    it('rejeita upload sem arquivo com 400 DOCUMENT_FILE_REQUIRED', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await uploadDocument(purchase.id, token, { includeFile: false });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('DOCUMENT_FILE_REQUIRED');
      const persistedCount = await testPrisma.document.count({
        where: { purchaseId: purchase.id },
      });
      expect(persistedCount).toBe(0);
    });

    it('rejeita MIME não permitido (text/plain) com 400 INVALID_DOCUMENT_TYPE', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await uploadDocument(purchase.id, token, {
        buffer: Buffer.from('hello world', 'latin1'),
        filename: 'nota.txt',
        mimetype: 'text/plain',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DOCUMENT_TYPE');
      const persisted = await testPrisma.document.count({
        where: { purchaseId: purchase.id },
      });
      expect(persisted).toBe(0);
    });

    it('rejeita MIME não permitido (application/json) com 400', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await uploadDocument(purchase.id, token, {
        buffer: Buffer.from('{"a":1}', 'latin1'),
        filename: 'dados.json',
        mimetype: 'application/json',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DOCUMENT_TYPE');
    });

    it('rejeita extensão não permitida mesmo com MIME parecido', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await uploadDocument(purchase.id, token, {
        buffer: pdfBuffer(),
        filename: 'nota.exe',
        mimetype: 'application/pdf',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DOCUMENT_TYPE');
    });

    it('rejeita PDF com conteúdo incompatível (magic bytes) — sem persistir arquivo', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const before = await testPrisma.document.count();
      const response = await uploadDocument(purchase.id, token, {
        buffer: notAPdfBuffer(),
        filename: 'falso.pdf',
        mimetype: 'application/pdf',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DOCUMENT_CONTENT');
      expect(await testPrisma.document.count()).toBe(before);
    });

    it('rejeita imagem com conteúdo incompatível (magic bytes)', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await uploadDocument(purchase.id, token, {
        buffer: notAnImageBuffer(),
        filename: 'falsa.png',
        mimetype: 'image/png',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DOCUMENT_CONTENT');
    });

    it('rejeita arquivo maior que 10 MB com 400 DOCUMENT_TOO_LARGE e sem persisitir', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      // 10 MB + 1 byte, começando com o header de PDF: o tamanho é barrado pelo
      // multer (limite) antes de qualquer validação de conteúdo/gravação.
      const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
      oversized.write('%PDF-', 0, 'latin1');

      const before = await testPrisma.document.count();
      const response = await uploadDocument(purchase.id, token, {
        buffer: oversized,
        filename: 'enorme.pdf',
        mimetype: 'application/pdf',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('DOCUMENT_TOO_LARGE');
      expect(await testPrisma.document.count()).toBe(before);
    });

    it('rejeita name vazio com 400 VALIDATION_ERROR', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await uploadDocument(purchase.id, token, {
        name: '   ',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      const persistedCount = await testPrisma.document.count({
        where: { purchaseId: purchase.id },
      });
      expect(persistedCount).toBe(0);
    });

    it('rejeita type inválido com 400 VALIDATION_ERROR', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await uploadDocument(purchase.id, token, {
        type: 'NOT_A_TYPE',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('ignora campos extras do formulário (sem mass assignment)', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await uploadDocument(purchase.id, token, {
        extraFields: { storagePath: '../../etc/passwd', purchaseId: crypto.randomUUID() },
      });

      expect(response.status).toBe(201);
      // O purchaseId/storagePath forjados não têm efeito.
      expect(response.body.document.purchaseId).toBe(purchase.id);
      expect(response.body.document.storagePath).toBeUndefined();

      const persisted = await testPrisma.document.findUnique({
        where: { id: response.body.document.id },
      });
      expect(persisted?.purchaseId).toBe(purchase.id);
      expect(persisted?.storagePath).not.toContain('..');
      expect(persisted?.storagePath).toMatch(/^[0-9a-f-]{36}\.pdf$/);

      await trackStoragePaths();
    });
  });

  // -------------------------------------------------------------------------
  // Ownership e segurança
  // -------------------------------------------------------------------------
  describe('ownership e segurança', () => {
    it('rejeita upload sem autenticação com 401', async () => {
      const { user } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await api()
        .post(`/purchases/${purchase.id}/documents`)
        .attach('file', pdfBuffer(), { filename: 'nota.pdf', contentType: 'application/pdf' })
        .field('name', 'Nota')
        .field('type', 'INVOICE');

      expect(response.status).toBe(401);
      const persistedCount = await testPrisma.document.count({
        where: { purchaseId: purchase.id },
      });
      expect(persistedCount).toBe(0);
    });

    it('rejeita upload na purchase de outro usuário com 403 e sem persistir', async () => {
      const owner = await createUserWithToken();
      const attacker = await createUserWithToken();
      const purchase = await createPurchase(owner.user.id);

      const before = await testPrisma.document.count();
      const response = await uploadDocument(purchase.id, attacker.token);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('PURCHASE_ACCESS_DENIED');
      expect(await testPrisma.document.count()).toBe(before);
    });

    it('rejeita upload em purchase inexistente com 404 e sem arquivo órfão', async () => {
      const { token } = await createUserWithToken();

      const before = await testPrisma.document.count();
      const response = await uploadDocument(crypto.randomUUID(), token);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PURCHASE_NOT_FOUND');
      expect(await testPrisma.document.count()).toBe(before);
    });

    it('usuário não acessa (download) documento privado de outro usuário', async () => {
      const owner = await createUserWithToken();
      const other = await createUserWithToken();
      const purchase = await createPurchase(owner.user.id);

      const upload = await uploadDocument(purchase.id, owner.token);
      expect(upload.status).toBe(201);
      const documentId = upload.body.document.id as string;

      const response = await api()
        .get(`/documents/${documentId}`)
        .set('Authorization', `Bearer ${other.token}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('DOCUMENT_ACCESS_DENIED');

      await trackStoragePaths();
    });
  });

  // -------------------------------------------------------------------------
  // Path traversal
  // -------------------------------------------------------------------------
  describe('path traversal', () => {
    it('armazena com nome seguro mesmo com filename malicioso (não escreve fora de uploads)', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const maliciousName = '../../../../../tmp/garantia-traversal.pdf';
      const response = await uploadDocument(purchase.id, token, {
        buffer: pdfBuffer(),
        filename: maliciousName,
        mimetype: 'application/pdf',
        name: 'Traversal',
      });

      expect(response.status).toBe(201);

      const persisted = await testPrisma.document.findUnique({
        where: { id: response.body.document.id },
      });
      // O nome de armazenamento é um UUID + extensão: nunca o caminho relativo.
      expect(persisted?.storagePath).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      expect(persisted?.storagePath).not.toContain('..');
      expect(persisted?.storagePath).not.toContain('/');

      // O arquivo real está DENTRO de backend/uploads (e existe).
      const absolutePath = path.resolve(uploadsDirectory, persisted?.storagePath as string);
      expect(absolutePath.startsWith(`${uploadsDirectory}${path.sep}`)).toBe(true);
      expect(await fileExists(persisted?.storagePath as string)).toBe(true);

      // Nada foi escrito fora do diretório de uploads.
      const outsidePath = path.resolve(uploadsDirectory, maliciousName);
      expect(outsidePath.startsWith(`${uploadsDirectory}${path.sep}`)).toBe(false);

      // O cliente multipart já reduz o filename ao basename; e o armazenamento
      // é sempre um UUID seguro, nunca o caminho informado.
      expect(persisted?.fileName).toBe('garantia-traversal.pdf');
      expect(persisted?.fileName).not.toContain('..');
      expect(persisted?.fileName).not.toContain('/');

      await trackStoragePaths();
    });

    it('o conteúdo gravado corresponde exatamente ao enviado', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      const buffer = pdfBuffer();

      const response = await uploadDocument(purchase.id, token, { buffer });
      expect(response.status).toBe(201);

      const persisted = await testPrisma.document.findUnique({
        where: { id: response.body.document.id },
      });
      const onDisk = await readFile(
        path.resolve(uploadsDirectory, persisted?.storagePath as string),
      );
      expect(onDisk.equals(buffer)).toBe(true);

      await trackStoragePaths();
    });
  });
});
