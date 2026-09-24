/*
  Warnings:

  - You are about to drop the column `feature_image` on the `pages` table. All the data in the column will be lost.
  - You are about to drop the column `cover_image` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `cover_image` on the `programs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pages" DROP COLUMN "feature_image",
ADD COLUMN     "feature_image_id" INTEGER;

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "cover_image",
ADD COLUMN     "cover_image_id" INTEGER;

-- AlterTable
ALTER TABLE "programs" DROP COLUMN "cover_image",
ADD COLUMN     "cover_image_id" INTEGER;

-- CreateIndex
CREATE INDEX "pages_feature_image_id_idx" ON "pages"("feature_image_id");

-- CreateIndex
CREATE INDEX "posts_cover_image_id_idx" ON "posts"("cover_image_id");

-- CreateIndex
CREATE INDEX "programs_cover_image_id_idx" ON "programs"("cover_image_id");

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_feature_image_id_fkey" FOREIGN KEY ("feature_image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_cover_image_id_fkey" FOREIGN KEY ("cover_image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_image_id_fkey" FOREIGN KEY ("cover_image_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
