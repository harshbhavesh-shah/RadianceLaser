-- CreateTable
CREATE TABLE "auditLogs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "actorUid" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "auditLogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditLogs_clinicId_createdAt_idx" ON "auditLogs"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "auditLogs_clinicId_targetType_targetId_idx" ON "auditLogs"("clinicId", "targetType", "targetId");
