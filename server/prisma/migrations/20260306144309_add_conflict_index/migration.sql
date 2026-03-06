-- CreateIndex
CREATE INDEX "NewsArticle_isConflict_scrapedAt_idx" ON "NewsArticle"("isConflict", "scrapedAt");
