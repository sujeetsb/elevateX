import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { AiConversationType } from '@prisma/client';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  conversationId: z.string().min(1),
});

export async function GET(
  req: Request,
  context: { params: { conversationId: string } },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const params = paramsSchema.parse(context.params);

    const conversation = await prisma.aiConversation.findFirst({
      where: { id: params.conversationId, userId: session.user.id, type: AiConversationType.MENTOR },
      select: { id: true },
    });
    if (!conversation) throw notFound('Conversation not found');

    const messages = await prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return NextResponse.json({
      ok: true,
      data: {
        conversationId: conversation.id,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

