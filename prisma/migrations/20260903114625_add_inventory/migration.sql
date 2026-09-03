-- CreateTable
CREATE TABLE "inventoryItems" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderThreshold" INTEGER,
    "expiryDate" TEXT,
    "batchNumber" TEXT,
    "supplier" TEXT,
    "costPerUnit" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "inventoryItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventoryLogs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "note" TEXT,
    "actorUid" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "inventoryLogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventoryItems_clinicId_idx" ON "inventoryItems"("clinicId");

-- CreateIndex
CREATE INDEX "inventoryLogs_clinicId_idx" ON "inventoryLogs"("clinicId");

-- CreateIndex
CREATE INDEX "inventoryLogs_itemId_createdAt_idx" ON "inventoryLogs"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "inventoryLogs" ADD CONSTRAINT "inventoryLogs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventoryItems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
