-- CreateTable
CREATE TABLE "noShowPlaybooks" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "offerText" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "delayHours" INTEGER NOT NULL DEFAULT 4,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "noShowPlaybooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "noShowMessageLogs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "sentAt" BIGINT NOT NULL,

    CONSTRAINT "noShowMessageLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "noShowSurveyResponses" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "reason" TEXT,
    "comment" TEXT,
    "sentAt" BIGINT,
    "respondedAt" BIGINT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "noShowSurveyResponses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "noShowPlaybooks_clinicId_idx" ON "noShowPlaybooks"("clinicId");

-- CreateIndex
CREATE INDEX "noShowMessageLogs_clinicId_idx" ON "noShowMessageLogs"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "noShowMessageLogs_appointmentId_playbookId_key" ON "noShowMessageLogs"("appointmentId", "playbookId");

-- CreateIndex
CREATE UNIQUE INDEX "noShowSurveyResponses_appointmentId_key" ON "noShowSurveyResponses"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "noShowSurveyResponses_token_key" ON "noShowSurveyResponses"("token");

-- CreateIndex
CREATE INDEX "noShowSurveyResponses_clinicId_idx" ON "noShowSurveyResponses"("clinicId");

-- CreateIndex
CREATE INDEX "appointments_clinicId_status_date_idx" ON "appointments"("clinicId", "status", "date");

-- AddForeignKey
ALTER TABLE "noShowPlaybooks" ADD CONSTRAINT "noShowPlaybooks_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "messageTemplates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
