import { z } from 'zod';
import { UTApi, UTFile } from 'uploadthing/server';
import { badRequest } from '@/server/errors/http-error';
import { getUploadThingToken } from '@/lib/uploadthing/resolve-token';

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const FETCH_RETRIES = 3;

/** UploadThing asset metadata accepted from the client after a successful upload. */
export const uploadThingResumeAssetSchema = z.object({
  fileUrl: z.string().url(),
  fileKey: z.string().min(1).max(512),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().max(120).optional(),
  title: z.string().max(120).optional(),
});

export type UploadThingResumeAsset = z.infer<typeof uploadThingResumeAssetSchema>;

export function validateUpload(input: unknown): UploadThingResumeAsset {
  return uploadThingResumeAssetSchema.parse(input);
}

let utapiSingleton: UTApi | null = null;

function getUtapi(): UTApi {
  try {
    const token = getUploadThingToken();
    utapiSingleton ??= new UTApi({ token });
    return utapiSingleton;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UploadThing is not configured.';
    throw badRequest(msg);
  }
}

function isTrustedUploadThingHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'utfs.io') return true;
  if (h.endsWith('.ufs.sh')) return true;
  if (h.endsWith('uploadthing.com') || h.endsWith('uploadthing.net')) return true;
  if (h.includes('uploadthing')) return true;
  return false;
}

export function assertTrustedUploadThingUrl(fileUrl: string): URL {
  let url: URL;
  try {
    url = new URL(fileUrl);
  } catch {
    throw badRequest('Invalid file URL.');
  }
  if (url.protocol !== 'https:') throw badRequest('Resume file URL must use HTTPS.');
  if (!isTrustedUploadThingHost(url.hostname)) {
    throw badRequest('Resume file URL must be hosted on UploadThing.');
  }
  return url;
}

export async function fetchResumeBytesFromUrl(fileUrl: string): Promise<Buffer> {
  assertTrustedUploadThingUrl(fileUrl);
  let lastErr: unknown;
  for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(fileUrl, {
        redirect: 'follow',
        cache: 'no-store',
        headers: { Accept: '*/*' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cl = res.headers.get('content-length');
      if (cl && Number(cl) > MAX_RESUME_BYTES) throw new Error('File too large');
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > MAX_RESUME_BYTES) throw new Error('File too large');
      return buf;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw badRequest(lastErr instanceof Error ? lastErr.message : 'Could not download resume file.');
}

export async function uploadFile(input: {
  buffer: Buffer;
  fileName: string;
  contentType?: string;
}): Promise<{ key: string; url: string; mimeType?: string }> {
  const utapi = getUtapi();
  const file = new UTFile([input.buffer], input.fileName, { type: input.contentType });
  const res = await utapi.uploadFiles(file);
  const row = Array.isArray(res) ? res[0] : res;
  if (!row || typeof row !== 'object' || !('key' in row) || !('ufsUrl' in row)) {
    throw badRequest('UploadThing upload failed.');
  }
  const r = row as { key: string; ufsUrl: string; type?: string };
  return { key: r.key, url: r.ufsUrl, mimeType: r.type };
}

export async function deleteFile(fileKey: string): Promise<{ success: boolean; deletedCount: number }> {
  const utapi = getUtapi();
  return utapi.deleteFiles(fileKey);
}

/** Resolves a stable download URL for a stored UploadThing file key; falls back to stored URL. */
export async function getFileUrl(fileKey: string, fallbackUrl?: string | null): Promise<string | null> {
  try {
    const utapi = getUtapi();
    const { data } = await utapi.getFileUrls(fileKey);
    const first = data[0]?.url;
    if (first) return first;
  } catch {
    // ignore — caller may use fallback
  }
  return fallbackUrl?.trim() ? fallbackUrl : null;
}
