// PDF -> PNG conversion utility (first step of NVIDIA PDF support).
//
// Receives a PDF file as a Buffer and renders each page into a PNG Buffer, in
// document order, so the pages can later be sent to the NVIDIA Nemotron vision
// model (which accepts images, not PDFs). This module is intentionally isolated
// and self-contained: it performs NO network calls, writes NO files and knows
// nothing about any AI provider.
//
// Rendering is done fully in-process with `pdfjs-dist` (Mozilla's PDF.js) and
// `@napi-rs/canvas` (prebuilt native Skia bindings). Neither requires system
// binaries such as Ghostscript, ImageMagick or GraphicsMagick, so the same
// install works on a plain Render Node.js container without extra buildpacks.
import { createCanvas } from '@napi-rs/canvas';
import {
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Hard cap on how many pages a single PDF may contain, to bound work/memory. */
export const MAX_PDF_PAGES = 10;

/**
 * Vertical rendering scale. 144 DPI equivalents (~2x the PDF 72 DPI baseline):
 * enough resolution for the model to read invoice text without producing huge
 * base64 payloads.
 */
const RENDER_SCALE = 2;

/**
 * Thrown when the PDF is empty, malformed, encrypted or otherwise cannot be
 * parsed. Survives as an internal error so callers can map it to the public API.
 */
export class PdfConversionInvalidDocumentError extends Error {
  constructor() {
    super('PDF document is empty or invalid');
    this.name = 'PdfConversionInvalidDocumentError';
  }
}

/**
 * Thrown when the PDF exceeds {@link MAX_PDF_PAGES}. Kept separate from the
 * invalid-document error so the caller can distinguish "too big" from "broken"
 * and surface the appropriate message.
 */
export class PdfConversionTooManyPagesError extends Error {
  readonly pageCount: number;
  readonly maxPages: number;

  constructor(pageCount: number, maxPages: number) {
    super(`PDF has ${pageCount} pages, exceeding the limit of ${maxPages}`);
    this.name = 'PdfConversionTooManyPagesError';
    this.pageCount = pageCount;
    this.maxPages = maxPages;
  }
}

const isPdfSignature = (buffer: Buffer): boolean =>
  buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';

/**
 * Renders a single PDF page to a PNG Buffer.
 *
 * PDF.js is typed against the browser DOM (`HTMLCanvasElement`), while
 * `@napi-rs/canvas` exposes a Node-native, API-compatible canvas. The casts below
 * are the standard interop bridge: at runtime PDF.js only uses the 2D context
 * surface, which both implementations share.
 */
const renderPageToPng = async (page: PDFPageProxy): Promise<Buffer> => {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  return canvas.toBuffer('image/png');
};

/**
 * Converts every page of a PDF into a PNG image, preserving page order.
 *
 * @param pdfBuffer Raw bytes of the PDF file.
 * @returns One PNG `Buffer` per page, in the same order as in the PDF.
 * @throws {PdfConversionInvalidDocumentError} when the buffer is empty/invalid.
 * @throws {PdfConversionTooManyPagesError} when the PDF has more than
 *   {@link MAX_PDF_PAGES} pages.
 */
export const convertPdfToPngImages = async (pdfBuffer: Buffer): Promise<Buffer[]> => {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0 || !isPdfSignature(pdfBuffer)) {
    throw new PdfConversionInvalidDocumentError();
  }

  // The buffer is copied into a fresh Uint8Array so PDF.js never detaches the
  // caller's bytes (PDF.js transfers the underlying ArrayBuffer internally).
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    // The document is fully in memory; nothing to fetch and no filesystem use.
    useSystemFonts: false,
  });

  let document: PDFDocumentProxy;
  try {
    document = await loadingTask.promise;
  } catch {
    // A wrong password or malformed bytes surface here; details are never
    // propagated so the utility keeps a single, stable internal error surface.
    await loadingTask.destroy();
    throw new PdfConversionInvalidDocumentError();
  }

  try {
    if (document.numPages === 0) throw new PdfConversionInvalidDocumentError();

    if (document.numPages > MAX_PDF_PAGES) {
      throw new PdfConversionTooManyPagesError(document.numPages, MAX_PDF_PAGES);
    }

    const images: Buffer[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      images.push(await renderPageToPng(page));
      page.cleanup();
    }

    return images;
  } finally {
    // Releases PDF.js resources; no temp files were ever written.
    await loadingTask.destroy();
  }
};
