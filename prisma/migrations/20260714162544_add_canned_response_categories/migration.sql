/*
  Warnings:

  - Replaces the free-text `category` column on `canned_responses` with a
    managed `canned_response_categories` table + `category_id` FK. Existing
    distinct category strings are backfilled into rows before the old column
    is dropped, so no data is lost.

*/

-- CreateTable
CREATE TABLE "canned_response_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canned_response_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "canned_response_categories_name_key" ON "canned_response_categories"("name");

-- CreateIndex
CREATE INDEX "canned_response_categories_deleted_at_idx" ON "canned_response_categories"("deleted_at");

-- AlterTable: add the new column alongside the old one (not replacing it yet)
ALTER TABLE "canned_responses" ADD COLUMN "category_id" TEXT;

-- Data migration: one category row per distinct existing free-text value
INSERT INTO "canned_response_categories" ("id", "name", "sort_order", "created_at", "updated_at")
SELECT md5(random()::text || clock_timestamp()::text || t."category"), t."category", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "category" FROM "canned_responses" WHERE "category" IS NOT NULL) t;

-- Data migration: point each response at its matching new category row
UPDATE "canned_responses" cr
SET "category_id" = crc."id"
FROM "canned_response_categories" crc
WHERE cr."category" = crc."name";

-- DropIndex
DROP INDEX "canned_responses_category_idx";

-- AlterTable: now safe to drop, data has been migrated above
ALTER TABLE "canned_responses" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "canned_responses_category_id_idx" ON "canned_responses"("category_id");

-- AddForeignKey
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "canned_response_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
