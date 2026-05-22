/**
 * Ensures PDF worker files are present in the Next.js standalone bundle.
 *
 * pdf-parse resolves its worker via getPath() at runtime. Next.js file tracing
 * does not follow that dynamic path, so the worker is missing on Vercel unless
 * we copy it into .next/standalone after the build.
 */

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { getPath } from 'pdf-parse/worker';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const standaloneRoot = resolve(root, '.next/standalone');

if (!existsSync(standaloneRoot)) {
  console.log('[copy-pdf-worker] no standalone output found — skipping');
  process.exit(0);
}

const req = createRequire(import.meta.url);

/** Copy a file into the standalone node_modules tree, preserving its path under node_modules/. */
function copyIntoStandalone(resolvedSrc) {
  const marker = `${root}/node_modules/`;
  const idx = resolvedSrc.indexOf(marker);
  if (idx === -1) {
    console.warn('[copy-pdf-worker] could not derive relative path for', resolvedSrc);
    return;
  }
  const rel = resolvedSrc.slice(idx + marker.length);
  const dest = resolve(standaloneRoot, 'node_modules', rel);
  if (!existsSync(resolvedSrc)) {
    console.warn('[copy-pdf-worker] source missing, skipping:', resolvedSrc);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(resolvedSrc, dest);
  console.log('[copy-pdf-worker] copied →', dest.replace(root + '/', ''));
}

// Primary worker — use the exported pdf-parse/worker API (internal path is not in package exports).
copyIntoStandalone(getPath());

// Fallback worker bundled with pdfjs-dist.
try {
  copyIntoStandalone(req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'));
} catch (err) {
  console.warn('[copy-pdf-worker] pdfjs-dist worker not resolved:', err instanceof Error ? err.message : err);
}
