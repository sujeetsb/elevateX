import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { handleApiError } from '@/server/errors/handler';
import { requireAdminSession } from '@/server/auth/require-admin';
import { notFound } from '@/server/errors/http-error';
import { cacheService } from '@/server/cache/cache-service';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  subscriptionTier: z.enum(['FREE', 'PRO', 'ENTERPRISE']).optional(),
  currentRole: z.string().max(160).optional(),
  targetRole: z.string().max(160).optional(),
  onboardingComplete: z.boolean().optional(),
  suspend: z.boolean().optional(),
  restore: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());

    const user = await prisma.user.findFirst({ where: { id } });
    if (!user) throw notFound('User not found');

    if (body.restore) {
      await prisma.user.update({
        where: { id },
        data: { deletedAt: null, suspendedAt: null },
      });
      await cacheService.invalidateUser(id);
      const updated = await prisma.user.findUnique({ where: { id }, include: { profile: true } });
      return NextResponse.json({ ok: true, data: updated });
    }

    if (user.deletedAt) throw notFound('User not found');

    await prisma.$transaction(async tx => {
      if (body.name !== undefined || body.role !== undefined || body.suspend !== undefined) {
        await tx.user.update({
          where: { id },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.role !== undefined ? { role: body.role } : {}),
            ...(body.suspend !== undefined ? { suspendedAt: body.suspend ? new Date() : null } : {}),
          },
        });
      }

      const profileFields = {
        ...(body.subscriptionTier !== undefined ? { subscriptionTier: body.subscriptionTier } : {}),
        ...(body.currentRole !== undefined ? { currentRole: body.currentRole } : {}),
        ...(body.targetRole !== undefined ? { targetRole: body.targetRole } : {}),
        ...(body.onboardingComplete !== undefined ? { onboardingComplete: body.onboardingComplete } : {}),
      };

      if (Object.keys(profileFields).length > 0) {
        await tx.profile.upsert({
          where: { userId: id },
          create: { userId: id, ...profileFields },
          update: profileFields,
        });
      }
    });

    await cacheService.invalidateUser(id);

    if (body.subscriptionTier !== undefined) {
      await prisma.cachedAiResponse.deleteMany({
        where: { userId: id, cacheKey: { startsWith: 'salary-insights:' } },
      });
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const adminSession = await requireAdminSession();
    const { id } = await ctx.params;

    if (id === adminSession.user.id) {
      return NextResponse.json({ ok: false, message: 'Cannot delete your own account' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw notFound('User not found');

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await cacheService.invalidateUser(id);

    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
