-- CreateTable
CREATE TABLE "emailConnections" (
    "id" TEXT NOT NULL,
    "gmailAccount" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" BIGINT,
    "connectedAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "emailConnections_pkey" PRIMARY KEY ("id")
);
