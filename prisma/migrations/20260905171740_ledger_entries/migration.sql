-- CreateTable
CREATE TABLE "ledgerEntries" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountInr" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "createdByEmail" TEXT,

    CONSTRAINT "ledgerEntries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledgerEntries_date_idx" ON "ledgerEntries"("date");
