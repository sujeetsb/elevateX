import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { AiConversationType } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const conversations = await prisma.aiConversation.findMany({
      where: { userId: session.user.id, type: AiConversationType.MENTOR },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        conversations: conversations.map(c => ({
          conversationId: c.id,
          title: c.title,
          messageCount: c._count.messages,
          updatedAt: c.updatedAt,
        })),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

