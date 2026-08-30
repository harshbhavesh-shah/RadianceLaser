-- CreateTable
CREATE TABLE "sessionTypeDefs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "badgeText" TEXT NOT NULL,
    "badgeClassName" TEXT NOT NULL,
    "chartColor" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "sessionTypeDefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessionTypeDefs_clinicId_idx" ON "sessionTypeDefs"("clinicId");
