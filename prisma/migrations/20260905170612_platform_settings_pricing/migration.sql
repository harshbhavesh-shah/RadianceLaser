-- CreateTable
CREATE TABLE "platformSettings" (
    "id" TEXT NOT NULL,
    "annualPriceInr" INTEGER NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "updatedByEmail" TEXT,

    CONSTRAINT "platformSettings_pkey" PRIMARY KEY ("id")
);
