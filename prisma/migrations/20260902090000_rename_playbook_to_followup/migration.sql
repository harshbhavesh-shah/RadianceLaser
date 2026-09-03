-- Rename "NoShowPlaybook" to "NoShowFollowUp" throughout — table, its FK/
-- index constraints, and the playbookId column on noShowMessageLogs that
-- references it. A plain rename (not drop+recreate) since both tables are
-- empty (feature just shipped, no real data yet) but a rename is also
-- simply the correct operation regardless — nothing about the shape
-- changed, only the name.

ALTER TABLE "noShowPlaybooks" RENAME TO "noShowFollowUps";
ALTER TABLE "noShowFollowUps" RENAME CONSTRAINT "noShowPlaybooks_pkey" TO "noShowFollowUps_pkey";
ALTER TABLE "noShowFollowUps" RENAME CONSTRAINT "noShowPlaybooks_templateId_fkey" TO "noShowFollowUps_templateId_fkey";
ALTER INDEX "noShowPlaybooks_clinicId_idx" RENAME TO "noShowFollowUps_clinicId_idx";

ALTER TABLE "noShowMessageLogs" RENAME COLUMN "playbookId" TO "followUpId";
-- @@unique renders as a plain unique index here (not a named table
-- constraint), so this needs ALTER INDEX, not ALTER TABLE ... RENAME
-- CONSTRAINT.
ALTER INDEX "noShowMessageLogs_appointmentId_playbookId_key" RENAME TO "noShowMessageLogs_appointmentId_followUpId_key";
