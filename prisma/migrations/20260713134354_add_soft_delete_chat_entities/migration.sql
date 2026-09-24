-- AlterTable
ALTER TABLE "canned_responses" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "chat_programs" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "chat_regions" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "deleted_at" TIMESTAMP(0);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(0);

-- CreateIndex
CREATE INDEX "chat_programs_deleted_at_idx" ON "chat_programs"("deleted_at");

-- CreateIndex
CREATE INDEX "chat_regions_deleted_at_idx" ON "chat_regions"("deleted_at");

-- CreateIndex
CREATE INDEX "chat_sessions_deleted_at_idx" ON "chat_sessions"("deleted_at");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
