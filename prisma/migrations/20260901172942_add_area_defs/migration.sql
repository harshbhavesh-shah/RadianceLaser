-- CreateTable
CREATE TABLE "areaDefs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDurationMinutes" INTEGER,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "areaDefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "areaDefs_clinicId_idx" ON "areaDefs"("clinicId");

-- CreateIndex
CREATE INDEX "areaDefs_clinicId_sessionType_idx" ON "areaDefs"("clinicId", "sessionType");
