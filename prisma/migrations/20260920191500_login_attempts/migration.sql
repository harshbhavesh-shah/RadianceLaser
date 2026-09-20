-- CreateTable
CREATE TABLE "loginAttempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "loginAttempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loginAttempts_email_createdAt_idx" ON "loginAttempts"("email", "createdAt");
