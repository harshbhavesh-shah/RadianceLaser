-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "purchaseDate" TEXT NOT NULL,
    "expiryDate" TEXT,
    "paymentMethod" TEXT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "packages_clinicId_idx" ON "packages"("clinicId");

-- CreateIndex
CREATE INDEX "packages_patientId_idx" ON "packages"("patientId");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
