-- AlterTable
ALTER TABLE "clinics"
  ADD COLUMN "autoRenewEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "razorpayCustomerId" TEXT,
  ADD COLUMN "razorpaySubscriptionId" TEXT,
  ADD COLUMN "razorpaySubscriptionStatus" TEXT,
  ADD COLUMN "autoRenewPlanAmountInr" INTEGER,
  ADD COLUMN "dunningEmailSentForStatus" TEXT;

-- AlterTable
ALTER TABLE "payments"
  ADD COLUMN "razorpaySubscriptionId" TEXT;
