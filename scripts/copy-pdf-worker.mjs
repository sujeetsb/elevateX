/**
 * Copies pdf.worker.mjs into the standalone bundle produced by `output: 'standalone'`.
 *
 * pdfjs-dist loads the worker file via a dynamic import at runtime. Next.js file
 * tracing doesn't detect this reference, so the file is missing from the standalone
 * node_modules tree. Copying it here ensures it is present inside the Lambda on
 * both Vercel and any other standalone-based deployment.
 */

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const req = createRequire(import.meta.url);
const workerSrc = req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
const workerDest = resolve(
  root,
  '.next/standalone/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
);

if (!existsSync(resolve(root, '.next/standalone'))) {
  console.log('[copy-pdf-worker] no standalone output found — skipping');
  process.exit(0);
}

mkdirSync(dirname(workerDest), { recursive: true });
copyFileSync(workerSrc, workerDest);
console.log('[copy-pdf-worker] copied pdf.worker.mjs →', workerDest.replace(root + '/', ''));
