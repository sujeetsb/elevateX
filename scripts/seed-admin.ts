/**
 * Creates the primary ElevateX super-admin if none exists.
 *
 * Usage:
 *   npm run db:seed-admin
 *
 * Env overrides (optional):
 *   ADMIN_EMAIL=admin@elevatex.ai
 *   ADMIN_PASSWORD=your-secure-password
 *   ADMIN_NAME="Platform Admin"
 */
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_EMAIL = 'admin@elevatex.ai';
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe-Admin-2026!';
const DEFAULT_NAME = process.env.ADMIN_NAME ?? 'ElevateX Admin';

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase();

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN, deletedAt: null },
    select: { email: true },
  });

  if (existingSuperAdmin) {
    console.log(`Super admin already exists (${existingSuperAdmin.email}). Skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      name: DEFAULT_NAME,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      profile: { create: { onboardingComplete: true } },
      analytics: { create: {} },
    },
  });

  console.log('Created super admin:');
  console.log(`  Email:    ${admin.email}`);
  console.log(`  Password: ${process.env.ADMIN_PASSWORD ? '(from ADMIN_PASSWORD env)' : DEFAULT_PASSWORD}`);
  console.log('  Portal:   /admin/login');
  console.log('');
  console.log('Change the password after first login in production.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
