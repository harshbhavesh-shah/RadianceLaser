-- CreateTable
CREATE TABLE "whatsappConnections" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bhashUser" TEXT NOT NULL,
    "bhashPass" TEXT,
    "senderId" TEXT NOT NULL,
    "lastError" TEXT,
    "connectedAt" BIGINT,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "whatsappConnections_pkey" PRIMARY KEY ("id")
);
