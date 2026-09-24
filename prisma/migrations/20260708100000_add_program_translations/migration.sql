-- Per-language override of a Program's name (see ProgramTranslation in
-- schema.prisma). Program.name stays as the fallback for languages without
-- a translation row yet.
CREATE TABLE "chat_program_translations" (
    "id" SERIAL NOT NULL,
    "program_id" TEXT NOT NULL,
    "language_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_program_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_program_translations_program_id_language_id_key"
    ON "chat_program_translations"("program_id", "language_id");

ALTER TABLE "chat_program_translations"
    ADD CONSTRAINT "chat_program_translations_program_id_fkey"
    FOREIGN KEY ("program_id") REFERENCES "chat_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_program_translations"
    ADD CONSTRAINT "chat_program_translations_language_id_fkey"
    FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
