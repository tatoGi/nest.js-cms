-- Per-language override of an automatic message's body (see CannedResponseTranslation
-- in schema.prisma). CannedResponse.body stays as the fallback for languages
-- without a translation row yet.
CREATE TABLE "canned_response_translations" (
    "id" SERIAL NOT NULL,
    "canned_response_id" TEXT NOT NULL,
    "language_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canned_response_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "canned_response_translations_canned_response_id_language_id_key"
    ON "canned_response_translations"("canned_response_id", "language_id");

ALTER TABLE "canned_response_translations"
    ADD CONSTRAINT "canned_response_translations_canned_response_id_fkey"
    FOREIGN KEY ("canned_response_id") REFERENCES "canned_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "canned_response_translations"
    ADD CONSTRAINT "canned_response_translations_language_id_fkey"
    FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
