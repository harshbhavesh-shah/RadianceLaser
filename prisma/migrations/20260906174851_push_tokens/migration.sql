-- CreateTable
CREATE TABLE "pushTokens" (
    "token" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "clinicId" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "pushTokens_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "pushTokens_clinicId_idx" ON "pushTokens"("clinicId");

-- CreateIndex
CREATE INDEX "pushTokens_uid_idx" ON "pushTokens"("uid");
