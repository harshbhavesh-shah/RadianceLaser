-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT,
    "patientAge" INTEGER,
    "patientGender" TEXT,
    "patientAddress" TEXT,
    "consultingDoctor" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "visitId" TEXT,
    "packageId" TEXT,
    "appointmentId" TEXT,
    "notes" TEXT,
    "issuedByUid" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_counters" (
    "clinicId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "receipt_counters_pkey" PRIMARY KEY ("clinicId")
);

-- CreateIndex
CREATE INDEX "receipts_clinicId_idx" ON "receipts"("clinicId");

-- CreateIndex
CREATE INDEX "receipts_clinicId_createdAt_idx" ON "receipts"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "receipts_clinicId_appointmentId_idx" ON "receipts"("clinicId", "appointmentId");

-- CreateIndex
CREATE INDEX "receipts_patientId_idx" ON "receipts"("patientId");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
