import "server-only";
import { prisma } from "@/lib/db/client";

// Backs the Gmail OAuth grant for admin@radiancelaser.in — see
// prisma/schema.prisma's EmailConnection comment. One row, always at this
// id, same singleton pattern as lib/db/platformSettings.ts.
const CONNECTION_ID = "global";

export interface EmailConnectionInfo {
  gmailAccount: string;
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  connectedAt: number;
}

export async function getEmailConnection(): Promise<EmailConnectionInfo | null> {
  const row = await prisma.emailConnection.findUnique({ where: { id: CONNECTION_ID } });
  if (!row) return null;
  return {
    gmailAccount: row.gmailAccount,
    refreshToken: row.refreshToken,
    accessToken: row.accessToken,
    accessTokenExpiresAt: row.accessTokenExpiresAt !== null ? Number(row.accessTokenExpiresAt) : null,
    connectedAt: Number(row.connectedAt),
  };
}

export async function saveEmailConnection(input: { gmailAccount: string; refreshToken: string }): Promise<void> {
  const now = BigInt(Date.now());
  await prisma.emailConnection.upsert({
    where: { id: CONNECTION_ID },
    create: { id: CONNECTION_ID, gmailAccount: input.gmailAccount, refreshToken: input.refreshToken, connectedAt: now, updatedAt: now },
    // A re-connect (re-running the OAuth flow) refreshes the grant but
    // shouldn't lose track of when it was first connected.
    update: { gmailAccount: input.gmailAccount, refreshToken: input.refreshToken, updatedAt: now },
  });
}

/** Called after every access-token refresh so the cached token is reused
 * across requests instead of hitting Google's token endpoint every time. */
export async function updateCachedAccessToken(accessToken: string, expiresAt: number): Promise<void> {
  await prisma.emailConnection.update({
    where: { id: CONNECTION_ID },
    data: { accessToken, accessTokenExpiresAt: BigInt(expiresAt), updatedAt: BigInt(Date.now()) },
  });
}

export async function deleteEmailConnection(): Promise<void> {
  await prisma.emailConnection.deleteMany({ where: { id: CONNECTION_ID } });
}
