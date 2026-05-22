import mammoth from 'mammoth';

export type ExtractResult = { text: string; mime: string };

let pdfEnvReady: Promise<void> | null = null;

/**
 * Configure pdfjs for Node/serverless before the first PDF parse.
 *
 * pdf-parse v2 exposes PDFParse.setWorker(getPath()) — the supported way to point
 * pdfjs at its worker file. Manually setting GlobalWorkerOptions on pdfjs-dist
 * is fragile and breaks on Vercel when the worker file is missing or workerSrc
 * ends up empty (pdfjs 4.x throws "No GlobalWorkerOptions.workerSrc specified").
 */
async function ensurePdfEnv(): Promise<void> {
  pdfEnvReady ??= (async () => {
    // Canvas polyfills must be on globalThis BEFORE pdf-parse loads pdfjs-dist.
    try {
      const canvas = await import('@napi-rs/canvas');
      const g = globalThis as Record<string, unknown>;
      g.DOMMatrix ??= canvas.DOMMatrix;
      g.ImageData ??= canvas.ImageData;
      g.Path2D ??= canvas.Path2D;
    } catch {
      // optional — text extraction works without canvas in most PDFs
    }

    const { getPath } = await import('pdf-parse/worker');
    const { PDFParse } = await import('pdf-parse');
    PDFParse.setWorker(getPath());
  })();

  return pdfEnvReady;
}

function resetPdfEnv() {
  pdfEnvReady = null;
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
 * Extract plain text from a PDF, DOCX, or plain-text buffer.
 */
export async function extractResumeText(buffer: Buffer, fileNameOrMime: string): Promise<ExtractResult> {
  const { mime, ext } = inferMime(fileNameOrMime);

  if (mime === 'application/pdf' || ext === 'pdf') {
    await ensurePdfEnv();
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const res = await parser.getText();
      return { text: (res.text || '').replace(/\s+\n/g, '\n').trim(), mime: 'application/pdf' };
    } catch (err) {
      resetPdfEnv();
      throw err;
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
