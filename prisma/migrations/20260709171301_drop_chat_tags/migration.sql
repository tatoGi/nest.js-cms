-- DropForeignKey
ALTER TABLE "chat_tag_translations" DROP CONSTRAINT "chat_tag_translations_chat_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "chat_tag_translations" DROP CONSTRAINT "chat_tag_translations_language_id_fkey";

-- DropTable
DROP TABLE "chat_tag_translations";

-- DropTable
DROP TABLE "chat_tags";
