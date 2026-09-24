-- AlterTable
ALTER TABLE "canned_response_translations" ADD COLUMN     "buttonText" VARCHAR(100);

-- AlterTable
ALTER TABLE "canned_responses" ADD COLUMN     "buttonText" VARCHAR(100);
