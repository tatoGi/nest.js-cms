-- AlterTable
ALTER TABLE "chat_config"
ADD COLUMN "notification_pitch" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "notification_repeat_count" INTEGER NOT NULL DEFAULT 1;
