import mammoth from 'mammoth';
import { createRequire } from 'node:module';

export type ExtractResult = { text: string; mime: string };

let pdfReady: Promise<void> | null = null;

/**
 * pdfjs-dist 4.x needs three things in a Node/serverless environment:
 *   1. DOMMatrix / ImageData / Path2D on globalThis (from @napi-rs/canvas)
 *   2. GlobalWorkerOptions.workerSrc pointing to the real worker file so
 *      Node can resolve it — without this Vercel throws
 *      "Cannot find module '.../pdf.worker.mjs'" even in fake-worker mode.
 *
 * We run this once, lazily, before the first PDF parse.
 */
async function ensurePdfEnv(): Promise<void> {
  pdfReady ??= (async () => {
    // ── 1. Canvas polyfills ────────────────────────────────────────────────
    const canvas = await import('@napi-rs/canvas').catch(() => null);
    if (canvas) {
      const g = globalThis as Record<string, unknown>;
      g.DOMMatrix ??= canvas.DOMMatrix;
      g.ImageData ??= canvas.ImageData;
      g.Path2D ??= canvas.Path2D;
    }

    // ── 2. Worker path ─────────────────────────────────────────────────────
    // pdfjs-dist defaults workerSrc to the relative string './pdf.worker.mjs'.
    // In Vercel Lambda that relative resolution fails. Resolve the absolute
    // path explicitly so Node can locate it in the bundled file tree.
    try {
      const req = createRequire(import.meta.url);
      const workerPath = req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
      const { GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      GlobalWorkerOptions.workerSrc = workerPath;
    } catch {
      // If the worker file is missing for any reason, clear workerSrc so
      // pdfjs falls back to inline execution rather than crashing.
      try {
        const { GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        GlobalWorkerOptions.workerSrc = '';
      } catch {
        // ignore
      }
    }
  })();

  await pdfReady;
}

function inferMime(nameOrMime: string): { mime: string; ext: string } {
  const s = nameOrMime.toLowerCase();
  if (s.includes('pdf') || s.endsWith('.pdf')) return { mime: 'application/pdf', ext: 'pdf' };
  if (s.includes('wordprocessingml') || s.endsWith('.docx')) {
    return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
  }
  if (s.includes('text/plain') || s.endsWith('.txt')) return { mime: 'text/plain', ext: 'txt' };
  return { mime: 'application/octet-stream', ext: '' };
}

/**
 * Extract plain text from PDF, DOCX, or UTF-8 text.
 */
export async function extractResumeText(buffer: Buffer, fileNameOrMime: string): Promise<ExtractResult> {
  const { mime, ext } = inferMime(fileNameOrMime);

  if (mime === 'application/pdf' || ext === 'pdf') {
    // Polyfill canvas globals and fix pdfjs worker path before loading pdf-parse.
    await ensurePdfEnv();
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const res = await parser.getText();
      return { text: (res.text || '').replace(/\s+\n/g, '\n').trim(), mime: 'application/pdf' };
    } finally {
      await parser.destroy();
    }
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const res = await mammoth.extractRawText({ buffer });
    return { text: (res.value || '').replace(/\s+\n/g, '\n').trim(), mime };
  }

  return { text: buffer.toString('utf8').replace(/\u0000/g, '').trim(), mime: 'text/plain' };
}
