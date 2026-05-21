import { NextResponse } from 'next/server';
import { LEARNING_CATALOG } from '@/server/learning/catalog';

export async function GET() {
  return NextResponse.json({ ok: true, data: LEARNING_CATALOG });
}
