/*
  Warnings:

  - You are about to drop the column `region` on the `chat_sessions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "chat_sessions_region_idx";

-- AlterTable
ALTER TABLE "chat_sessions" DROP COLUMN "region",
ADD COLUMN     "region_id" TEXT;

-- CreateTable
CREATE TABLE "chat_regions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_region_translations" (
    "id" SERIAL NOT NULL,
    "region_id" TEXT NOT NULL,
    "language_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_region_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_region_translations_region_id_language_id_key" ON "chat_region_translations"("region_id", "language_id");

-- CreateIndex
CREATE INDEX "chat_sessions_region_id_idx" ON "chat_sessions"("region_id");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "chat_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_region_translations" ADD CONSTRAINT "chat_region_translations_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "chat_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_region_translations" ADD CONSTRAINT "chat_region_translations_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
