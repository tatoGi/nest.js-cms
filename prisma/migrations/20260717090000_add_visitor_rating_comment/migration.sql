-- Optional free-text comment alongside the visitor's post-chat star rating.
ALTER TABLE "chat_sessions" ADD COLUMN "visitor_rating_comment" VARCHAR(1000);
