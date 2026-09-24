/*
  Warnings:

  - You are about to drop the column `offHoursBody` on the `canned_response_translations` table. All the data in the column will be lost.
  - You are about to drop the column `offHoursBody` on the `canned_responses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "canned_response_translations" DROP COLUMN "offHoursBody";

-- AlterTable
ALTER TABLE "canned_responses" DROP COLUMN "offHoursBody";
