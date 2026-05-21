import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db/prisma';
import { handleApiError } from '@/server/errors/handler';
import { conflict } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  email: z.string().email().max(256),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
    await enforceRateLimit(`auth.register:${ip}`, { limit: 10, window: '60 m' });

    const json = await req.json();
    const body = registerSchema.parse(json);

    const existing = await prisma.user.findFirst({
      where: { email: body.email.trim().toLowerCase(), deletedAt: null },
      select: { id: true },
    });

    if (existing) throw conflict('Email is already registered');

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email: body.email.trim().toLowerCase(),
        name: body.name?.trim() || null,
        passwordHash,
        role: 'USER',
        profile: {
          create: {
            onboardingComplete: false,
          },
        },
        analytics: { create: {} },
      },
      select: { id: true, email: true, name: true },
    });

    // NextAuth Credentials provider will sign the user in after calling its `signIn`.
    return NextResponse.json({ ok: true, data: { userId: user.id } }, { status: 201 });
  } catch (e) {
    // Zod & prisma errors are handled below.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { ok: false, code: 'CONFLICT', message: 'Email is already registered' },
        { status: 409 },
      );
    }
    if (e instanceof ZodError) {
      return NextResponse.json({ ok: false, code: 'BAD_REQUEST', message: 'Validation failed' }, { status: 400 });
    }
    return handleApiError(e);
  }
}

