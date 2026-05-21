import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from './http-error';

/** Prisma codes: server unreachable, connection refused, timeout, etc. */
const PRISMA_DB_UNAVAILABLE = new Set(['P1000', 'P1001', 'P1002', 'P1017']);

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { ok: false, code: err.code, message: err.message, details: err.details },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { ok: false, code: 'BAD_REQUEST', message: 'Validation failed', details: err.flatten() },
      { status: 400 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && PRISMA_DB_UNAVAILABLE.has(err.code)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[api] database unavailable', { code: err.code, meta: err.meta });
    }
    return NextResponse.json(
      {
        ok: false,
        code: 'SERVICE_UNAVAILABLE',
        message:
          'Could not connect to the database. Check DATABASE_URL, network access, and that your database (e.g. Neon) is running.',
      },
      { status: 503 },
    );
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[api] prisma initialization failed', err.message);
    }
    return NextResponse.json(
      {
        ok: false,
        code: 'SERVICE_UNAVAILABLE',
        message:
          'Could not connect to the database. Check DATABASE_URL, network access, and that your database (e.g. Neon) is running.',
      },
      { status: 503 },
    );
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (process.env.NODE_ENV === 'development') {
    console.error('[api]', err);
  }
  return NextResponse.json({ ok: false, code: 'INTERNAL', message }, { status: 500 });
}
