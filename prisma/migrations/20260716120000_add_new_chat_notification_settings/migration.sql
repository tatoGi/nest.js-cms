-- Second notification-sound category: "a brand-new session arrived", distinct
-- from the existing notification_* fields ("a message landed in a chat I'm
-- not looking at"). Operator-only, no visitor equivalent.
ALTER TABLE "chat_config" ADD COLUMN "new_chat_notification_sound" TEXT NOT NULL DEFAULT 'chime';
ALTER TABLE "chat_config" ADD COLUMN "new_chat_notification_volume" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "chat_config" ADD COLUMN "new_chat_notification_duration" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "chat_config" ADD COLUMN "new_chat_notification_pitch" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "chat_config" ADD COLUMN "new_chat_notification_repeat_count" INTEGER NOT NULL DEFAULT 1;
