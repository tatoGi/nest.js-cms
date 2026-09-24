-- Rename the existing single name field to display_name
ALTER TABLE "users" RENAME COLUMN "name" TO "display_name";

-- Add first_name / last_name, backfilled from the existing display_name
ALTER TABLE "users" ADD COLUMN "first_name" VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "last_name" VARCHAR(255) NOT NULL DEFAULT '';

UPDATE "users" SET
  "first_name" = split_part("display_name", ' ', 1),
  "last_name" = CASE
    WHEN position(' ' in "display_name") > 0
    THEN substring("display_name" from position(' ' in "display_name") + 1)
    ELSE ''
  END;

ALTER TABLE "users" ALTER COLUMN "first_name" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "last_name" DROP DEFAULT;
