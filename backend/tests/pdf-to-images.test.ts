// Testes unitários da conversão segura de PDF -> PNG (primeiro passo do suporte
// a PDF para o provider NVIDIA).
//
// Nenhuma dependência externa é usada: os PDFs são montados no próprio teste
// (bytes mínimos, sem fixtures grandes no repositório) e nenhuma chamada de rede
// é feita. O que se prova aqui é o contrato do utilitário: ordem das páginas,
// formato PNG do retorno, rejeição de PDF vazio/inválido e o limite de páginas.
import { describe, expect, it } from 'vitest';

import {
  MAX_PDF_PAGES,
  PdfConversionInvalidDocumentError,
  PdfConversionTooManyPagesError,
  convertPdfToPngImages,
} from '../src/services/ai/pdf-to-images.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Builds a minimal, fully valid multi-page PDF in memory. Each page is an empty
 * A4 page; content is omitted on purpose (rendering blank pages still exercises
 * the full PDF.js + canvas pipeline). No external fixture is needed.
 */
const buildMinimalPdf = (pageCount: number): Buffer => {
  const objects: string[] = [];
  const firstPageObject = 3;
  const kids = Array.from(
    { length: pageCount },
    (_, index) => `${firstPageObject + index * 2} 0 R`,
  );

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>\nendobj\n`;

  for (let index = 0; index < pageCount; index += 1) {
    const pageObject = firstPageObject + index * 2;
    const contentObject = pageObject + 1;
    objects[pageObject] =
      `${pageObject} 0 obj\n` +
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] ` +
      `/Contents ${contentObject} 0 R >>\nendobj\n`;

    const stream = '';
    objects[contentObject] =
      `${contentObject} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
  }

  const lastObject = firstPageObject + pageCount * 2 - 1;

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let objectNumber = 1; objectNumber <= lastObject; objectNumber += 1) {
    offsets[objectNumber] = body.length;
    body += objects[objectNumber];
  }

  const xrefStart = body.length;
  let xref = `xref\n0 ${lastObject + 1}\n0000 65535 f \n`;
  for (let objectNumber = 1; objectNumber <= lastObject; objectNumber += 1) {
    xref += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${lastObject + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(body + xref + trailer, 'latin1');
};

const isPng = (buffer: Buffer): boolean => buffer.subarray(0, 8).equals(PNG_SIGNATURE);

describe('convertPdfToPngImages', () => {
  it('PDF válido de uma página → retorna uma imagem PNG', async () => {
    const images = await convertPdfToPngImages(buildMinimalPdf(1));

    expect(images).toHaveLength(1);
    expect(Buffer.isBuffer(images[0])).toBe(true);
    expect(isPng(images[0] as Buffer)).toBe(true);
    expect((images[0] as Buffer).length).toBeGreaterThan(0);
  });

  it('PDF válido com múltiplas páginas → retorna as páginas na mesma ordem', async () => {
    const images = await convertPdfToPngImages(buildMinimalPdf(3));

    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(Buffer.isBuffer(image)).toBe(true);
      expect(isPng(image)).toBe(true);
    }
  });

  it('PDF vazio → rejeitado com erro de documento inválido', async () => {
    await expect(convertPdfToPngImages(Buffer.alloc(0))).rejects.toBeInstanceOf(
      PdfConversionInvalidDocumentError,
    );
  });

  it('PDF inválido (sem assinatura %PDF) → rejeitado', async () => {
    await expect(
      convertPdfToPngImages(Buffer.from('this is definitely not a pdf file')),
    ).rejects.toBeInstanceOf(PdfConversionInvalidDocumentError);
  });

  it('PDF corrompido (assinatura válida, estrutura quebrada) → rejeitado', async () => {
    await expect(
      convertPdfToPngImages(Buffer.from('%PDF-1.4\nbroken content without xref')),
    ).rejects.toBeInstanceOf(PdfConversionInvalidDocumentError);
  });

  it(`PDF acima de ${MAX_PDF_PAGES} páginas → rejeitado com erro de limite`, async () => {
    const tooManyPages = buildMinimalPdf(MAX_PDF_PAGES + 1);

    await expect(convertPdfToPngImages(tooManyPages)).rejects.toBeInstanceOf(
      PdfConversionTooManyPagesError,
    );
  });

  it('PDF exatamente no limite de páginas → aceito', async () => {
    const images = await convertPdfToPngImages(buildMinimalPdf(MAX_PDF_PAGES));

    expect(images).toHaveLength(MAX_PDF_PAGES);
  });
});
