-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "serialNumber" TEXT,
    "purchaseDate" TEXT,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "machines_clinicId_idx" ON "machines"("clinicId");
