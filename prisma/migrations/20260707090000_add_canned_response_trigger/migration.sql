-- AlterTable
ALTER TABLE "canned_responses" ADD COLUMN "trigger" VARCHAR(30);
ALTER TABLE "canned_responses" ADD COLUMN "delay_seconds" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "canned_responses_trigger_key" ON "canned_responses"("trigger");
