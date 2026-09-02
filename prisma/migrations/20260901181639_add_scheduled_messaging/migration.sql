-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "reminderSentAt" BIGINT;

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "feedbackSurveyDelayHours" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "feedbackSurveyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "visitFeedback" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "sentAt" BIGINT,
    "respondedAt" BIGINT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "visitFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visitFeedback_visitId_key" ON "visitFeedback"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "visitFeedback_token_key" ON "visitFeedback"("token");

-- CreateIndex
CREATE INDEX "visitFeedback_clinicId_idx" ON "visitFeedback"("clinicId");

-- CreateIndex
CREATE INDEX "visitFeedback_clinicId_createdAt_idx" ON "visitFeedback"("clinicId", "createdAt");

-- AddForeignKey
ALTER TABLE "visitFeedback" ADD CONSTRAINT "visitFeedback_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
