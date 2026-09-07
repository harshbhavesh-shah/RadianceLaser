-- CreateTable
CREATE TABLE "adminAuditLogs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "clinicName" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "adminAuditLogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adminAuditLogs_clinicId_idx" ON "adminAuditLogs"("clinicId");

-- CreateIndex
CREATE INDEX "adminAuditLogs_createdAt_idx" ON "adminAuditLogs"("createdAt");
