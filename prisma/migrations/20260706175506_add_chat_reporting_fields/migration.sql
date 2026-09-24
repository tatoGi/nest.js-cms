-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "program_id" TEXT,
ADD COLUMN     "region" VARCHAR(100);

-- CreateTable
CREATE TABLE "chat_programs" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_sessions_region_idx" ON "chat_sessions"("region");

-- CreateIndex
CREATE INDEX "chat_sessions_program_id_idx" ON "chat_sessions"("program_id");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "chat_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
