/**
 * Browser-side resume ingest: UploadThing → parse → POST /resumes → poll parse status.
 * Shared by onboarding-style flows and ATS + Resume Studio.
 */

const MAX_RESUME_TEXT = 100_000;

export const RESUME_ACCEPT = '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export function parseApiError(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback;
  const j = json as Record<string, unknown>;
  if (typeof j.message === 'string') return j.message;
  const err = j.error;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function normalizeUploadThingFile(file: unknown): {
  fileUrl: string;
  fileKey: string;
  fileName: string;
  mimeType?: string;
} | null {
  if (!file || typeof file !== 'object') return null;
  const f = file as Record<string, unknown>;
  const ufsUrl = typeof f.ufsUrl === 'string' ? f.ufsUrl.trim() : '';
  const legacyUrl = typeof f.url === 'string' ? f.url.trim() : '';
  const fileUrl = ufsUrl || legacyUrl;
  const key = typeof f.key === 'string' ? f.key : '';
  const name = typeof f.name === 'string' ? f.name : 'resume';
  const type = typeof f.type === 'string' ? f.type : undefined;
  if (!fileUrl || !key) return null;
  return { fileUrl, fileKey: key, fileName: name, mimeType: type };
}

export function validateLocalResumeFile(file: File): { ok: true } | { ok: false; message: string } {
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return { ok: false, message: 'File is too large (max 10MB).' };
  }
  const name = file.name.toLowerCase();
  const okExt = name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.txt');
  const mime = (file.type || '').toLowerCase();
  const okMime =
    mime.includes('pdf') ||
    mime.includes('msword') ||
    mime.includes('wordprocessingml') ||
    mime.includes('officedocument') ||
    mime === 'text/plain';
  if (!okExt && !okMime) {
    return { ok: false, message: 'Unsupported file type. Use PDF, DOC, DOCX, or TXT.' };
  }
  return { ok: true };
}

export async function postResumeFromUploadThingParts(parts: {
  fileUrl: string;
  fileKey: string;
  fileName: string;
  mimeType?: string;
}): Promise<
  { ok: true; resumeId: string; prefill: unknown } | { ok: false; message: string }
> {
  const parseRes = await fetch('/api/v1/onboarding/resume/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileUrl: parts.fileUrl,
      fileName: parts.fileName,
      mimeType: parts.mimeType,
    }),
    credentials: 'include',
  });
  const parseJson = await parseRes.json().catch(() => ({}));
  if (!parseRes.ok) {
    return { ok: false, message: parseApiError(parseJson, 'Could not parse that file.') };
  }

  const uploadRes = await fetch('/api/v1/resumes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileUrl: parts.fileUrl,
      fileKey: parts.fileKey,
      fileName: parts.fileName,
      mimeType: parts.mimeType,
    }),
    credentials: 'include',
  });
  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    return { ok: false, message: parseApiError(uploadJson, 'Could not save resume.') };
  }
  const resumeId = uploadJson?.data?.resumeId as string | undefined;
  if (!resumeId) return { ok: false, message: 'Server did not return a resume id.' };
  return { ok: true, resumeId, prefill: parseJson.data };
}

export async function postResumeFromRawText(
  rawText: string,
  title = 'Resume',
): Promise<{ ok: true; resumeId: string } | { ok: false; message: string }> {
  const trimmed = rawText.replace(/\r\n/g, '\n').trim().slice(0, MAX_RESUME_TEXT);
  if (trimmed.length < 20) {
    return { ok: false, message: 'Resume text is too short (at least 20 characters).' };
  }
  const uploadRes = await fetch('/api/v1/resumes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText: trimmed, title: title.slice(0, 120) }),
    credentials: 'include',
  });
  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    return { ok: false, message: parseApiError(uploadJson, 'Could not save resume.') };
  }
  const resumeId = uploadJson?.data?.resumeId as string | undefined;
  if (!resumeId) return { ok: false, message: 'Server did not return a resume id.' };
  return { ok: true, resumeId };
}

export async function pollResumeUntilComplete(
  resumeId: string,
  opts: { timeoutMs?: number; onStatus?: (s: string) => void } = {},
): Promise<
  | { ok: true; parseStatus: string; atsScore: number | null; parsedJson: unknown; parseError?: string | null }
  | { ok: false; message: string }
> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const sRes = await fetch(`/api/v1/resumes/${resumeId}`, { credentials: 'include' });
      const sJson = await sRes.json().catch(() => ({}));
      const status = sJson?.data?.parseStatus as string | undefined;
      if (status) opts.onStatus?.(status);
      if (status === 'COMPLETE') {
        const atsRaw = sJson?.data?.atsScore;
        const atsScore = atsRaw != null && Number.isFinite(Number(atsRaw)) ? Number(atsRaw) : null;
        return {
          ok: true,
          parseStatus: status,
          atsScore,
          parsedJson: sJson?.data?.parsedJson ?? null,
          parseError: (sJson?.data?.parseError as string | null) ?? null,
        };
      }
      if (status === 'FAILED') {
        return { ok: false, message: (sJson?.data?.parseError as string) || 'Resume parsing failed.' };
      }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Poll failed' };
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return { ok: false, message: 'Resume parsing is taking longer than expected. You can continue — check back shortly.' };
}
