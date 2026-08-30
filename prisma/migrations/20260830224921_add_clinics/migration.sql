-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "statsWindow" TEXT,
    "subscriptionStatus" TEXT NOT NULL,
    "trialEndsAt" BIGINT NOT NULL,
    "subscriptionRenewsAt" BIGINT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);
