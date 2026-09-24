/*
  Warnings:

  - You are about to drop the column `folder` on the `media` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "media_folder_idx";

-- AlterTable
ALTER TABLE "media" DROP COLUMN "folder",
ADD COLUMN     "folder_id" INTEGER,
ADD COLUMN     "legacy_folder" TEXT NOT NULL DEFAULT 'general';

-- CreateTable
CREATE TABLE "media_folders" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'site',
    "order" INTEGER NOT NULL DEFAULT 0,
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_folders_parent_id_idx" ON "media_folders"("parent_id");

-- CreateIndex
CREATE INDEX "media_folders_scope_idx" ON "media_folders"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "media_folders_slug_parent_id_key" ON "media_folders"("slug", "parent_id");

-- CreateIndex
CREATE INDEX "media_legacy_folder_idx" ON "media"("legacy_folder");

-- CreateIndex
CREATE INDEX "media_folder_id_idx" ON "media"("folder_id");

-- AddForeignKey
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "media_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
