import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { handleApiError } from '@/server/errors/handler';
import { requireAdminSession } from '@/server/auth/require-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);
    const skip = (page - 1) * limit;
    const roleFilter = searchParams.get('role')?.trim();
    const tierFilter = searchParams.get('tier')?.trim();

    const where = {
      deletedAt: null as Date | null,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              { name: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(roleFilter ? { role: roleFilter as 'USER' | 'ADMIN' | 'SUPER_ADMIN' } : {}),
      ...(tierFilter
        ? { profile: { subscriptionTier: tierFilter } }
        : {}),
    };

    const [users, total, courseCount, jobCount, proCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          suspendedAt: true,
          createdAt: true,
          profile: {
            select: {
              currentRole: true,
              targetRole: true,
              onboardingComplete: true,
              subscriptionTier: true,
            },
          },
          analytics: { select: { snapshot: true, lastActiveAt: true, aiTokensMonth: true, learningMinutes: true } },
          resumes: {
            where: { deletedAt: null },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { parseStatus: true, atsScore: true, title: true },
          },
          _count: {
            select: {
              applications: true,
              learningProgress: true,
              aiConversations: true,
              courseEnrollments: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
      prisma.course.count({ where: { deletedAt: null } }),
      prisma.job.count({ where: { deletedAt: null } }),
      prisma.profile.count({ where: { subscriptionTier: { in: ['PRO', 'pro', 'ENTERPRISE'] } } }),
    ]);

    return NextResponse.json({
      ok: true,
      data: users,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        stats: {
          courses: courseCount,
          jobs: jobCount,
          proSubscribers: proCount,
          estimatedRevenue: proCount * 19,
        },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
