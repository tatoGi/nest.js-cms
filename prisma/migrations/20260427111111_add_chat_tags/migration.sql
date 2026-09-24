-- CreateTable
CREATE TABLE "chat_tags" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_tags_type_idx" ON "chat_tags"("type");
