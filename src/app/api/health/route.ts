import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { getRedis } from '@/server/cache/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  return NextResponse.json({
    ok: true,
    service: 'elevatex-api',
    database,
    redis: !!getRedis(),
    timestamp: new Date().toISOString(),
  });
}
