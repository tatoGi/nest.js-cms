-- Adds a single "seen up to" timestamp per session for the operator-side
-- read receipt indicator.
ALTER TABLE "chat_sessions" ADD COLUMN "visitor_last_read_at" TIMESTAMP(0);
