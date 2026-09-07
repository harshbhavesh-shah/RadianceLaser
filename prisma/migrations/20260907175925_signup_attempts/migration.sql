-- CreateTable
CREATE TABLE "signupAttempts" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "signupAttempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signupAttempts_ipAddress_createdAt_idx" ON "signupAttempts"("ipAddress", "createdAt");
