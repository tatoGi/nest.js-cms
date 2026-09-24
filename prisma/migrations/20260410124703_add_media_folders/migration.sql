/*
  Warnings:

  - You are about to drop the column `created_at` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `folder_id` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `legacy_folder` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `mime_type` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `original_name` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `media` table. All the data in the column will be lost.
  - You are about to drop the `media_folders` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `mimeType` to the `media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `media` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "media" DROP CONSTRAINT "media_folder_id_fkey";

-- DropForeignKey
ALTER TABLE "media_folders" DROP CONSTRAINT "media_folders_parent_id_fkey";

-- DropIndex
DROP INDEX "media_created_at_idx";

-- DropIndex
DROP INDEX "media_folder_id_idx";

-- DropIndex
DROP INDEX "media_mime_type_idx";

-- AlterTable
ALTER TABLE "media" DROP COLUMN "created_at",
DROP COLUMN "folder_id",
DROP COLUMN "legacy_folder",
DROP COLUMN "mime_type",
DROP COLUMN "original_name",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "folder" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "media_folders";

-- CreateIndex
CREATE INDEX "media_folder_idx" ON "media"("folder");

-- CreateIndex
CREATE INDEX "media_mimeType_idx" ON "media"("mimeType");

-- CreateIndex
CREATE INDEX "media_createdAt_idx" ON "media"("createdAt");
