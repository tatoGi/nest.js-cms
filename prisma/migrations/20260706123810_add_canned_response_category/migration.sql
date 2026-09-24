/*
  Warnings:

  - You are about to drop the `program_content_blocks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `program_slug_aliases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `program_translations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `program_versions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `programs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "program_content_blocks" DROP CONSTRAINT "program_content_blocks_translation_id_fkey";

-- DropForeignKey
ALTER TABLE "program_slug_aliases" DROP CONSTRAINT "program_slug_aliases_language_id_fkey";

-- DropForeignKey
ALTER TABLE "program_slug_aliases" DROP CONSTRAINT "program_slug_aliases_program_id_fkey";

-- DropForeignKey
ALTER TABLE "program_translations" DROP CONSTRAINT "program_translations_language_id_fkey";

-- DropForeignKey
ALTER TABLE "program_translations" DROP CONSTRAINT "program_translations_program_id_fkey";

-- DropForeignKey
ALTER TABLE "program_versions" DROP CONSTRAINT "program_versions_language_id_fkey";

-- DropForeignKey
ALTER TABLE "program_versions" DROP CONSTRAINT "program_versions_program_id_fkey";

-- DropForeignKey
ALTER TABLE "programs" DROP CONSTRAINT "programs_cover_image_id_fkey";

-- DropForeignKey
ALTER TABLE "programs" DROP CONSTRAINT "programs_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "programs" DROP CONSTRAINT "programs_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "programs" DROP CONSTRAINT "programs_updated_by_id_fkey";

-- AlterTable
ALTER TABLE "canned_responses" ADD COLUMN     "category" VARCHAR(100),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "program_content_blocks";

-- DropTable
DROP TABLE "program_slug_aliases";

-- DropTable
DROP TABLE "program_translations";

-- DropTable
DROP TABLE "program_versions";

-- DropTable
DROP TABLE "programs";

-- CreateIndex
CREATE INDEX "canned_responses_category_idx" ON "canned_responses"("category");
