-- AlterTable
ALTER TABLE "chat_config"
ADD COLUMN "notification_sound" TEXT NOT NULL DEFAULT 'chime',
ADD COLUMN "notification_volume" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN "notification_duration" DOUBLE PRECISION NOT NULL DEFAULT 1;
