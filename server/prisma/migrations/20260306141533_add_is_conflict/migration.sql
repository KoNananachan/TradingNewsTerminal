/*
  Warnings:

  - You are about to alter the column `volume` on the `StockQuote` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "itemsFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "durationMs" INTEGER
);

-- CreateTable
CREATE TABLE "AiAnalysisLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleId" INTEGER NOT NULL,
    "model" TEXT,
    "provider" TEXT,
    "rawResponse" TEXT,
    "parsedResult" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "categorySlug" TEXT,
    "sentimentLabel" TEXT,
    "sentimentScore" REAL,
    CONSTRAINT "AiAnalysisLog_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "walletAddress" TEXT NOT NULL,
    "chainId" INTEGER,
    "eventType" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TradeOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "walletAddress" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "size" REAL NOT NULL,
    "price" REAL,
    "leverage" INTEGER NOT NULL DEFAULT 1,
    "midPrice" REAL,
    "notionalValue" REAL,
    "marginRequired" REAL,
    "status" TEXT NOT NULL DEFAULT 'demo',
    "sourceArticleId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EconomicEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "impact" TEXT NOT NULL,
    "actual" TEXT,
    "previous" TEXT,
    "estimate" TEXT,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "symbol" TEXT,
    "condition" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AlertTrigger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "alertId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertTrigger_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsCluster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "impactScore" REAL NOT NULL DEFAULT 0,
    "category" TEXT,
    "tickers" TEXT,
    "articleCount" INTEGER NOT NULL DEFAULT 0,
    "avgSentiment" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NewsClusterArticle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clusterId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsClusterArticle_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "NewsCluster" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InsiderTrade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "filingDate" DATETIME NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerTitle" TEXT,
    "transactionType" TEXT NOT NULL,
    "shares" REAL NOT NULL,
    "pricePerShare" REAL,
    "totalValue" REAL,
    "sharesOwned" REAL,
    "secFilingUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SentimentArchive" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeValue" TEXT NOT NULL,
    "avgScore" REAL NOT NULL,
    "articleCount" INTEGER NOT NULL,
    "bullishCount" INTEGER NOT NULL DEFAULT 0,
    "bearishCount" INTEGER NOT NULL DEFAULT 0,
    "neutralCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "googleId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "planExpiresAt" DATETIME,
    "alpacaApiKey" TEXT,
    "alpacaSecretKey" TEXT,
    "alpacaPaper" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NewsArticle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "summary" TEXT,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "publishedAt" DATETIME,
    "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categorySlug" TEXT,
    "sentiment" TEXT,
    "sentimentScore" REAL,
    "locationName" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "isConflict" BOOLEAN NOT NULL DEFAULT false,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NewsArticle_categorySlug_fkey" FOREIGN KEY ("categorySlug") REFERENCES "NewsCategory" ("slug") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_NewsArticle" ("analyzed", "categorySlug", "content", "createdAt", "externalId", "id", "imageUrl", "latitude", "locationName", "longitude", "publishedAt", "scrapedAt", "sentiment", "sentimentScore", "summary", "title", "updatedAt", "url") SELECT "analyzed", "categorySlug", "content", "createdAt", "externalId", "id", "imageUrl", "latitude", "locationName", "longitude", "publishedAt", "scrapedAt", "sentiment", "sentimentScore", "summary", "title", "updatedAt", "url" FROM "NewsArticle";
DROP TABLE "NewsArticle";
ALTER TABLE "new_NewsArticle" RENAME TO "NewsArticle";
CREATE UNIQUE INDEX "NewsArticle_externalId_key" ON "NewsArticle"("externalId");
CREATE INDEX "NewsArticle_categorySlug_idx" ON "NewsArticle"("categorySlug");
CREATE INDEX "NewsArticle_analyzed_idx" ON "NewsArticle"("analyzed");
CREATE INDEX "NewsArticle_scrapedAt_idx" ON "NewsArticle"("scrapedAt");
CREATE INDEX "NewsArticle_latitude_longitude_idx" ON "NewsArticle"("latitude", "longitude");
CREATE TABLE "new_StockQuote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "price" REAL NOT NULL,
    "change" REAL,
    "changePercent" REAL,
    "volume" BIGINT,
    "marketCap" REAL,
    "dayHigh" REAL,
    "dayLow" REAL,
    "previousClose" REAL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StockQuote" ("change", "changePercent", "dayHigh", "dayLow", "id", "marketCap", "name", "previousClose", "price", "symbol", "updatedAt", "volume") SELECT "change", "changePercent", "dayHigh", "dayLow", "id", "marketCap", "name", "previousClose", "price", "symbol", "updatedAt", "volume" FROM "StockQuote";
DROP TABLE "StockQuote";
ALTER TABLE "new_StockQuote" RENAME TO "StockQuote";
CREATE UNIQUE INDEX "StockQuote_symbol_key" ON "StockQuote"("symbol");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AiAnalysisLog_articleId_idx" ON "AiAnalysisLog"("articleId");

-- CreateIndex
CREATE INDEX "AiAnalysisLog_status_idx" ON "AiAnalysisLog"("status");

-- CreateIndex
CREATE INDEX "UserSession_walletAddress_idx" ON "UserSession"("walletAddress");

-- CreateIndex
CREATE INDEX "TradeOrder_walletAddress_idx" ON "TradeOrder"("walletAddress");

-- CreateIndex
CREATE INDEX "TradeOrder_createdAt_idx" ON "TradeOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicEvent_externalId_key" ON "EconomicEvent"("externalId");

-- CreateIndex
CREATE INDEX "EconomicEvent_date_idx" ON "EconomicEvent"("date");

-- CreateIndex
CREATE INDEX "EconomicEvent_country_idx" ON "EconomicEvent"("country");

-- CreateIndex
CREATE INDEX "EconomicEvent_impact_idx" ON "EconomicEvent"("impact");

-- CreateIndex
CREATE INDEX "EconomicEvent_released_date_idx" ON "EconomicEvent"("released", "date");

-- CreateIndex
CREATE INDEX "Alert_type_idx" ON "Alert"("type");

-- CreateIndex
CREATE INDEX "Alert_symbol_idx" ON "Alert"("symbol");

-- CreateIndex
CREATE INDEX "Alert_enabled_idx" ON "Alert"("enabled");

-- CreateIndex
CREATE INDEX "AlertTrigger_alertId_idx" ON "AlertTrigger"("alertId");

-- CreateIndex
CREATE INDEX "NewsCluster_impactScore_idx" ON "NewsCluster"("impactScore");

-- CreateIndex
CREATE INDEX "NewsCluster_createdAt_idx" ON "NewsCluster"("createdAt");

-- CreateIndex
CREATE INDEX "NewsClusterArticle_articleId_idx" ON "NewsClusterArticle"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsClusterArticle_clusterId_articleId_key" ON "NewsClusterArticle"("clusterId", "articleId");

-- CreateIndex
CREATE INDEX "InsiderTrade_symbol_idx" ON "InsiderTrade"("symbol");

-- CreateIndex
CREATE INDEX "InsiderTrade_filingDate_idx" ON "InsiderTrade"("filingDate");

-- CreateIndex
CREATE INDEX "InsiderTrade_transactionType_idx" ON "InsiderTrade"("transactionType");

-- CreateIndex
CREATE INDEX "SentimentArchive_scope_scopeValue_idx" ON "SentimentArchive"("scope", "scopeValue");

-- CreateIndex
CREATE UNIQUE INDEX "SentimentArchive_date_scope_scopeValue_key" ON "SentimentArchive"("date", "scope", "scopeValue");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_token_key" ON "AuthSession"("token");

-- CreateIndex
CREATE INDEX "AuthSession_token_idx" ON "AuthSession"("token");

-- CreateIndex
CREATE INDEX "VerificationCode_email_code_idx" ON "VerificationCode"("email", "code");

-- CreateIndex
CREATE INDEX "StockRecommendation_createdAt_idx" ON "StockRecommendation"("createdAt");

-- CreateIndex
CREATE INDEX "StockRecommendation_symbol_createdAt_idx" ON "StockRecommendation"("symbol", "createdAt");

-- CreateIndex
CREATE INDEX "TrackedStock_source_idx" ON "TrackedStock"("source");
