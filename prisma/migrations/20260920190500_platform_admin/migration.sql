-- CreateTable
CREATE TABLE "platformAdmins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "platformAdmins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platformAdmins_email_key" ON "platformAdmins"("email");
