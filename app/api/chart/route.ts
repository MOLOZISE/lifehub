import { NextRequest, NextResponse } from "next/server";

/**
 * Yahoo Finance OHLCV proxy.
 * Avoids CORS by fetching server-side.
 * GET /api/chart?ticker=AAPL&range=1y&interval=1d
 *
 * Korean stocks: append .KS automatically when market=KR
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker") ?? "";
  const range = searchParams.get("range") ?? "1y";
  const interval = searchParams.get("interval") ?? "1d";

  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 300 }, // cache 5 min
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo Finance returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ error: "No data returned for this ticker" }, { status: 404 });
    }

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens: (number | null)[] = quote.open ?? [];
    const highs: (number | null)[] = quote.high ?? [];
    const lows: (number | null)[] = quote.low ?? [];
    const closes: (number | null)[] = quote.close ?? [];
    const volumes: (number | null)[] = quote.volume ?? [];

    // Build OHLCV array, filter out null candles
    const bars = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i],
      }))
      .filter(b => b.open != null && b.close != null && b.high != null && b.low != null)
      .map(b => ({
        date: b.date,
        open: Math.round((b.open ?? 0) * 100) / 100,
        high: Math.round((b.high ?? 0) * 100) / 100,
        low: Math.round((b.low ?? 0) * 100) / 100,
        close: Math.round((b.close ?? 0) * 100) / 100,
        volume: b.volume ?? 0,
      }));

    const meta = result.meta ?? {};

    return NextResponse.json({
      ticker: meta.symbol ?? ticker,
      currency: meta.currency ?? "USD",
      regularMarketPrice: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      longName: meta.longName ?? meta.shortName ?? ticker,
      bars,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
