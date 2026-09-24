-- CreateTable
CREATE TABLE "chat_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "max_active_chats" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_config_pkey" PRIMARY KEY ("id")
);
