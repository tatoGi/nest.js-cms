-- CreateTable
CREATE TABLE "operator_threads" (
    "id" TEXT NOT NULL,
    "participant1_id" INTEGER NOT NULL,
    "participant2_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operator_threads_participant1_id_idx" ON "operator_threads"("participant1_id");

-- CreateIndex
CREATE INDEX "operator_threads_participant2_id_idx" ON "operator_threads"("participant2_id");

-- CreateIndex
CREATE UNIQUE INDEX "operator_threads_participant1_id_participant2_id_key" ON "operator_threads"("participant1_id", "participant2_id");

-- CreateIndex
CREATE INDEX "operator_messages_thread_id_idx" ON "operator_messages"("thread_id");

-- CreateIndex
CREATE INDEX "operator_messages_created_at_idx" ON "operator_messages"("created_at");

-- AddForeignKey
ALTER TABLE "operator_threads" ADD CONSTRAINT "operator_threads_participant1_id_fkey" FOREIGN KEY ("participant1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_threads" ADD CONSTRAINT "operator_threads_participant2_id_fkey" FOREIGN KEY ("participant2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_messages" ADD CONSTRAINT "operator_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "operator_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_messages" ADD CONSTRAINT "operator_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
