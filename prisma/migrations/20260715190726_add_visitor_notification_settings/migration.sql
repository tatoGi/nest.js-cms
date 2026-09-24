-- AlterTable
ALTER TABLE "chat_config"
ADD COLUMN "visitor_notification_sound" TEXT NOT NULL DEFAULT 'chime',
ADD COLUMN "visitor_notification_volume" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN "visitor_notification_duration" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "visitor_notification_pitch" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "visitor_notification_repeat_count" INTEGER NOT NULL DEFAULT 1;
