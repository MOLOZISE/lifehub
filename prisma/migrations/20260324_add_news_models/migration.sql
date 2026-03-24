-- CreateTable
CREATE TABLE "news_cache" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "articles" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_news_keywords" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_news_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_cache_category_key" ON "news_cache"("category");

-- CreateIndex
CREATE INDEX "user_news_keywords_userId_idx" ON "user_news_keywords"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_news_keywords_userId_keyword_key" ON "user_news_keywords"("userId", "keyword");

-- AddForeignKey
ALTER TABLE "user_news_keywords" ADD CONSTRAINT "user_news_keywords_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
