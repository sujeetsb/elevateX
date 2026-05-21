import mammoth from 'mammoth';

export type ExtractResult = { text: string; mime: string };

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
    // Dynamic import so non-PDF paths never load pdfjs; keep pdf-parse external in next.config.mjs.
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
