const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const ALLOWED_EXT = new Set(['pdf', 'docx', 'txt']);

const REJECTED_EXT = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
  'zip', 'rar', '7z', 'tar', 'gz',
  'exe', 'dmg', 'msi', 'apk', 'ipa',
  'doc', 'ppt', 'pptx', 'xls', 'xlsx',
]);

export type ResumeFileValidation =
  | { ok: true; mime: string; ext: string }
  | { ok: false; message: string };

function extFromName(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? (parts.pop() ?? '') : '';
}

/** Client + server validation for resume uploads (.pdf, .docx, .txt only). */
export function validateResumeUpload(fileName: string, mimeType?: string | null): ResumeFileValidation {
  const ext = extFromName(fileName);
  const mime = (mimeType ?? '').toLowerCase().trim();

  if (ext && REJECTED_EXT.has(ext)) {
    return { ok: false, message: 'Wrong file uploaded. Please upload a PDF or DOCX resume.' };
  }

  if (ext && !ALLOWED_EXT.has(ext)) {
    return { ok: false, message: 'Unsupported file type. Allowed: PDF, DOCX, or TXT.' };
  }

  if (mime && !ALLOWED_MIME.has(mime) && !mime.includes('pdf') && !mime.includes('wordprocessingml') && !mime.includes('text/plain')) {
    return { ok: false, message: 'Wrong file uploaded. Images, archives, and executables are not allowed.' };
  }

  const looksLikeResume =
    ext === 'pdf' ||
    ext === 'docx' ||
    ext === 'txt' ||
    mime.includes('pdf') ||
    mime.includes('wordprocessingml') ||
    mime.includes('text/plain');

  if (!looksLikeResume) {
    return { ok: false, message: 'Please upload a resume (PDF or DOCX).' };
  }

  return { ok: true, mime: mime || (ext === 'pdf' ? 'application/pdf' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain'), ext };
}
