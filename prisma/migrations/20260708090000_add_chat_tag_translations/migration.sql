-- Per-language override of a ChatTag's label (see ChatTagTranslation in
-- schema.prisma). ChatTag.label stays as the fallback for languages without
-- a translation row yet.
CREATE TABLE "chat_tag_translations" (
    "id" SERIAL NOT NULL,
    "chat_tag_id" TEXT NOT NULL,
    "language_id" INTEGER NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_tag_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_tag_translations_chat_tag_id_language_id_key"
    ON "chat_tag_translations"("chat_tag_id", "language_id");

ALTER TABLE "chat_tag_translations"
    ADD CONSTRAINT "chat_tag_translations_chat_tag_id_fkey"
    FOREIGN KEY ("chat_tag_id") REFERENCES "chat_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_tag_translations"
    ADD CONSTRAINT "chat_tag_translations_language_id_fkey"
    FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
