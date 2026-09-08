-- CreateTable
CREATE TABLE "packageTypeDefs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "suggestedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "packageTypeDefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "packageTypeDefs_clinicId_idx" ON "packageTypeDefs"("clinicId");

-- CreateIndex
CREATE INDEX "packageTypeDefs_clinicId_sessionType_idx" ON "packageTypeDefs"("clinicId", "sessionType");
