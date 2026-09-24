-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "contact_request_at" TIMESTAMP(0),
ADD COLUMN     "contact_request_email" VARCHAR(255),
ADD COLUMN     "contact_request_message" TEXT,
ADD COLUMN     "contact_request_name" VARCHAR(255),
ADD COLUMN     "contact_request_phone" VARCHAR(50);
