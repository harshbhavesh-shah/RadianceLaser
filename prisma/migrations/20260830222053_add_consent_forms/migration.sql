-- CreateTable
CREATE TABLE "consentFormTemplates" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sessionType" TEXT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "consentFormTemplates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentForms" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateTitle" TEXT NOT NULL,
    "visitId" TEXT,
    "renderedBody" TEXT NOT NULL,
    "signatureDataUrl" TEXT NOT NULL,
    "signedByName" TEXT NOT NULL,
    "witnessUid" TEXT,
    "witnessName" TEXT,
    "signedAt" BIGINT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "consentForms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consentFormTemplates_clinicId_idx" ON "consentFormTemplates"("clinicId");

-- CreateIndex
CREATE INDEX "consentForms_clinicId_idx" ON "consentForms"("clinicId");

-- CreateIndex
CREATE INDEX "consentForms_clinicId_signedAt_idx" ON "consentForms"("clinicId", "signedAt");

-- CreateIndex
CREATE INDEX "consentForms_patientId_idx" ON "consentForms"("patientId");

-- AddForeignKey
ALTER TABLE "consentForms" ADD CONSTRAINT "consentForms_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
