-- CreateTable
CREATE TABLE "twoFactorChallenges" (
    "uid" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" BIGINT NOT NULL,
    "attempts" INTEGER NOT NULL,

    CONSTRAINT "twoFactorChallenges_pkey" PRIMARY KEY ("uid")
);
