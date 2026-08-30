-- CreateTable
CREATE TABLE "patientPhotos" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "sessionType" TEXT,
    "area" TEXT,
    "date" TEXT,
    "dataUrl" TEXT NOT NULL,
    "label" TEXT,
    "sensitive" BOOLEAN NOT NULL,
    "uploadedByUid" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "patientPhotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messageTemplates" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "variableLabels" JSONB NOT NULL,
    "bodyPreview" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "messageTemplates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patientPhotos_clinicId_idx" ON "patientPhotos"("clinicId");

-- CreateIndex
CREATE INDEX "patientPhotos_patientId_idx" ON "patientPhotos"("patientId");

-- CreateIndex
CREATE INDEX "messageTemplates_clinicId_idx" ON "messageTemplates"("clinicId");

-- AddForeignKey
ALTER TABLE "patientPhotos" ADD CONSTRAINT "patientPhotos_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
