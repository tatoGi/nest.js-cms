-- AlterTable
ALTER TABLE "media" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "media_deletedAt_idx" ON "media"("deletedAt");
