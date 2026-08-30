-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "address" TEXT,
    "patientCode" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "nameLower" TEXT NOT NULL,
    "skinType" TEXT,
    "contraindications" TEXT,
    "legacyPatientNo" INTEGER,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "areas" JSONB,
    "appointmentId" TEXT,
    "packageId" TEXT,
    "machineId" TEXT,
    "performedByUid" TEXT,
    "performedByName" TEXT,
    "durationMinutes" INTEGER,
    "paymentMethod" TEXT,
    "followUpDate" TEXT,
    "followUpNote" TEXT,
    "legacyVisitNo" INTEGER,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_clinicId_idx" ON "patients"("clinicId");

-- CreateIndex
CREATE INDEX "patients_clinicId_phoneNormalized_idx" ON "patients"("clinicId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "patients_clinicId_nameLower_idx" ON "patients"("clinicId", "nameLower");

-- CreateIndex
CREATE INDEX "patients_clinicId_patientCode_idx" ON "patients"("clinicId", "patientCode");

-- CreateIndex
CREATE INDEX "patients_clinicId_createdAt_idx" ON "patients"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "visits_clinicId_idx" ON "visits"("clinicId");

-- CreateIndex
CREATE INDEX "visits_clinicId_createdAt_idx" ON "visits"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "visits_clinicId_date_idx" ON "visits"("clinicId", "date");

-- CreateIndex
CREATE INDEX "visits_clinicId_followUpDate_idx" ON "visits"("clinicId", "followUpDate");

-- CreateIndex
CREATE INDEX "visits_clinicId_packageId_idx" ON "visits"("clinicId", "packageId");

-- CreateIndex
CREATE INDEX "visits_clinicId_appointmentId_idx" ON "visits"("clinicId", "appointmentId");

-- CreateIndex
CREATE INDEX "visits_patientId_idx" ON "visits"("patientId");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
