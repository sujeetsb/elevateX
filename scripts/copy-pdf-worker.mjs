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

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const standaloneRoot = resolve(root, '.next/standalone');

if (!existsSync(standaloneRoot)) {
  console.log('[copy-pdf-worker] no standalone output found — skipping');
  process.exit(0);
}

const req = createRequire(import.meta.url);

/** Copy a resolved npm file into the standalone node_modules tree. */
function copyIntoStandalone(resolvedSrc) {
  const rel = resolvedSrc.split(`${root}/node_modules/`)[1];
  if (!rel) {
    console.warn('[copy-pdf-worker] could not derive relative path for', resolvedSrc);
    return;
  }
  const dest = resolve(standaloneRoot, 'node_modules', rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(resolvedSrc, dest);
  console.log('[copy-pdf-worker] copied →', dest.replace(root + '/', ''));
}

// Primary worker used by pdf-parse/worker getPath()
copyIntoStandalone(req.resolve('pdf-parse/dist/worker/pdf.worker.mjs'));

// Fallback worker bundled with pdfjs-dist (some code paths still reference it)
copyIntoStandalone(req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'));
