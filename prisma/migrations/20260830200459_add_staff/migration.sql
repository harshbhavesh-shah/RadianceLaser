-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN,
    "tourCompleted" BOOLEAN,
    "onboardingDismissed" BOOLEAN,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_clinicId_idx" ON "staff"("clinicId");
