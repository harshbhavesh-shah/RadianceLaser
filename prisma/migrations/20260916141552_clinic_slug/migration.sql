-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clinics_slug_key" ON "clinics"("slug");
