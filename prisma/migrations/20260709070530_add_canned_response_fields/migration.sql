-- AlterTable
ALTER TABLE "canned_response_translations" ADD COLUMN     "fields" JSONB;

-- AlterTable
ALTER TABLE "canned_responses" ADD COLUMN     "fields" JSONB;
