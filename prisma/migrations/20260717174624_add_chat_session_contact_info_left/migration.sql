-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "contact_info_left" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "chat_sessions_contact_info_left_idx" ON "chat_sessions"("contact_info_left");

-- Backfill: sessions that were previously tagged with the now-retired
-- 'Left Contact Info' resolutionTag get contact_info_left = true and their
-- resolutionTag reclassified as 'Client Ended Chat' (the visitor is the one
-- who triggers this close path), matching what ChatGateway.
-- handleVisitorLeaveContactInfo now writes for new sessions going forward.
UPDATE "chat_sessions"
SET "contact_info_left" = true,
    "resolution_tag" = 'Client Ended Chat'
WHERE "resolution_tag" = 'Left Contact Info';
