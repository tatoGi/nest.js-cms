-- AlterTable
ALTER TABLE "canned_response_translations" ADD COLUMN     "header" VARCHAR(255);

-- AlterTable
ALTER TABLE "canned_responses" ADD COLUMN     "header" VARCHAR(255);
