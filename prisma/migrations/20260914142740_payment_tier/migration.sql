ALTER TABLE "clinics"
  ADD COLUMN "autoRenewPlanTier" TEXT;

ALTER TABLE "payments"
  ADD COLUMN "planTier" TEXT,
  ADD COLUMN "enterpriseCenters" INTEGER;
