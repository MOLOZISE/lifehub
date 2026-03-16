import { NextRequest, NextResponse } from "next/server";

/**
 * Stock price proxy — supports Yahoo Finance (no key required)
 * GET /api/stock/price?tickers=AAPL,005930.KS
 * Returns: { prices: { [ticker]: { price, change, changePercent, currency } } }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("tickers") ?? "";
  if (!raw) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = raw.split(",").map(t => t.trim()).filter(Boolean);
  const results: Record<string, { price: number; change: number; changePercent: number; currency: string; name: string }> = {};

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d&includePrePost=false`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          next: { revalidate: 60 }, // 1 min cache
        });
        if (!res.ok) return;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return;

        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        results[ticker] = {
          price: Math.round(price * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
          currency: meta.currency ?? "USD",
          name: meta.longName ?? meta.shortName ?? ticker,
        };
      } catch {
        // skip failed tickers
      }
    })
  );

  return NextResponse.json({ prices: results });
}
