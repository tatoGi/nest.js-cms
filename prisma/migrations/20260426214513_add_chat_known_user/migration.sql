-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "known_user_id" INTEGER;

-- CreateIndex
CREATE INDEX "chat_sessions_known_user_id_idx" ON "chat_sessions"("known_user_id");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_known_user_id_fkey" FOREIGN KEY ("known_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
