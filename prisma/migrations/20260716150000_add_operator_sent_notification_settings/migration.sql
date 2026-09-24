-- Fourth notification-sound category, operator-only: the operator's own
-- outgoing message, mirroring the visitor's received/sent split.
ALTER TABLE "chat_config" ADD COLUMN "operator_sent_notification_sound" TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE "chat_config" ADD COLUMN "operator_sent_notification_volume" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "chat_config" ADD COLUMN "operator_sent_notification_duration" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "chat_config" ADD COLUMN "operator_sent_notification_pitch" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "chat_config" ADD COLUMN "operator_sent_notification_repeat_count" INTEGER NOT NULL DEFAULT 1;
