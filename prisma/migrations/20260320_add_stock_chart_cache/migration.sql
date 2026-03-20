CREATE TABLE "stock_chart_cache" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "bars" JSONB NOT NULL,
    "meta" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_chart_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_chart_cache_ticker_interval_range_key" ON "stock_chart_cache"("ticker", "interval", "range");
CREATE INDEX "stock_chart_cache_ticker_idx" ON "stock_chart_cache"("ticker");
