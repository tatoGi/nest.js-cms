/*
  Warnings:

  - You are about to drop the `chat_program_translations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_region_translations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "chat_program_translations" DROP CONSTRAINT "chat_program_translations_language_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_program_translations" DROP CONSTRAINT "chat_program_translations_program_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_region_translations" DROP CONSTRAINT "chat_region_translations_language_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_region_translations" DROP CONSTRAINT "chat_region_translations_region_id_fkey";

-- DropTable
DROP TABLE "chat_program_translations";

-- DropTable
DROP TABLE "chat_region_translations";
