-- AlterTable
ALTER TABLE "whatsappConnections" ADD COLUMN     "phoneNumber" TEXT;

-- CreateTable
CREATE TABLE "whatsappConversations" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "patientName" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "lastMessagePreview" TEXT NOT NULL,
    "lastMessageAt" BIGINT NOT NULL,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "whatsappConversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsappMessages" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "templateId" TEXT,
    "providerMessageId" TEXT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "whatsappMessages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsappConversations_clinicId_lastMessageAt_idx" ON "whatsappConversations"("clinicId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsappConversations_clinicId_phoneNumber_key" ON "whatsappConversations"("clinicId", "phoneNumber");

-- CreateIndex
CREATE INDEX "whatsappMessages_clinicId_idx" ON "whatsappMessages"("clinicId");

-- CreateIndex
CREATE INDEX "whatsappMessages_conversationId_createdAt_idx" ON "whatsappMessages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "whatsappMessages" ADD CONSTRAINT "whatsappMessages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "whatsappConversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
