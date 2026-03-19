CREATE TABLE "stock_ai_analysis" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "opinion" TEXT,
    "targetPrice" TEXT,
    "risk" TEXT,
    "summary" TEXT,
    "sections" JSONB NOT NULL,
    "sources" TEXT[],
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_ai_analysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_ai_analysis_ticker_key" ON "stock_ai_analysis"("ticker");
CREATE INDEX "stock_ai_analysis_ticker_idx" ON "stock_ai_analysis"("ticker");
