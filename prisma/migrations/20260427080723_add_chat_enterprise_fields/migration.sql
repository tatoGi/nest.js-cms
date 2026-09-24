-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "is_internal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "closed_by_operator_id" INTEGER,
ADD COLUMN     "closure_summary" TEXT,
ADD COLUMN     "resolution_tag" VARCHAR(50),
ADD COLUMN     "tag" VARCHAR(50),
ADD COLUMN     "visitor_browser" VARCHAR(500),
ADD COLUMN     "visitor_ip" VARCHAR(100),
ADD COLUMN     "visitor_page" VARCHAR(1000),
ADD COLUMN     "visitor_rating" INTEGER;

-- CreateTable
CREATE TABLE "canned_responses" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canned_responses_created_by_id_idx" ON "canned_responses"("created_by_id");

-- CreateIndex
CREATE INDEX "chat_sessions_closed_by_operator_id_idx" ON "chat_sessions"("closed_by_operator_id");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_closed_by_operator_id_fkey" FOREIGN KEY ("closed_by_operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
