-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "disabled" BOOLEAN,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "superAdmin" BOOLEAN;

-- CreateTable
CREATE TABLE "passwordResetTokens" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" BIGINT NOT NULL,
    "usedAt" BIGINT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "passwordResetTokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "passwordResetTokens_tokenHash_key" ON "passwordResetTokens"("tokenHash");

-- CreateIndex
CREATE INDEX "passwordResetTokens_uid_idx" ON "passwordResetTokens"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");
