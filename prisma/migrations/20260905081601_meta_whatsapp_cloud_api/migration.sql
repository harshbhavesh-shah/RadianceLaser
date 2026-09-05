/*
  Warnings:

  - You are about to drop the column `bhashPass` on the `whatsappConnections` table. All the data in the column will be lost.
  - You are about to drop the column `bhashUser` on the `whatsappConnections` table. All the data in the column will be lost.
  - You are about to drop the column `senderId` on the `whatsappConnections` table. All the data in the column will be lost.
  - Added the required column `phoneNumberId` to the `whatsappConnections` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "messageTemplates" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en_US';

-- AlterTable
ALTER TABLE "whatsappConnections" DROP COLUMN "bhashPass",
DROP COLUMN "bhashUser",
DROP COLUMN "senderId",
ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "appSecret" TEXT,
ADD COLUMN     "phoneNumberId" TEXT NOT NULL,
ADD COLUMN     "wabaId" TEXT;
