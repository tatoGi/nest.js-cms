-- Third notification-sound category, visitor-only: the visitor's own
-- outgoing message. Operators keep a fixed, non-configurable send tick.
ALTER TABLE "chat_config" ADD COLUMN "visitor_sent_notification_sound" TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE "chat_config" ADD COLUMN "visitor_sent_notification_volume" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "chat_config" ADD COLUMN "visitor_sent_notification_duration" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "chat_config" ADD COLUMN "visitor_sent_notification_pitch" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "chat_config" ADD COLUMN "visitor_sent_notification_repeat_count" INTEGER NOT NULL DEFAULT 1;
