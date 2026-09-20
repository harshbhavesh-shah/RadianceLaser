import "server-only";
import { prisma } from "@/lib/db/client";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface PlatformAdminAuthRecord {
  id: string;
  email: string;
  passwordHash: string | null;
}

/** The login-time lookup for a pure platform super-admin — an account with
 * no clinic at all (see prisma/schema.prisma PlatformAdmin comment, and
 * scripts/grantSuperAdmin.mjs). A clinic staff member who is ALSO a super
 * admin lives in StaffMember.superAdmin instead, not here. */
export async function getPlatformAdminByEmail(email: string): Promise<PlatformAdminAuthRecord | null> {
  const row = await prisma.platformAdmin.findUnique({ where: { email: normalizeEmail(email) } });
  return row ? { id: row.id, email: row.email, passwordHash: row.passwordHash } : null;
}

export async function createPlatformAdmin(email: string, passwordHash: string): Promise<PlatformAdminAuthRecord> {
  const row = await prisma.platformAdmin.create({
    data: { email: normalizeEmail(email), passwordHash, createdAt: BigInt(Date.now()) },
  });
  return { id: row.id, email: row.email, passwordHash: row.passwordHash };
}

export async function setPlatformAdminPasswordHash(id: string, passwordHash: string): Promise<void> {
  await prisma.platformAdmin.update({ where: { id }, data: { passwordHash } });
}
