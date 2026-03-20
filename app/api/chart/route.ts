import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Yahoo Finance OHLCV proxy with DB cache.
 * GET /api/chart?ticker=AAPL&range=1y&interval=1d
 *
 * TTL 전략:
 *   일봉(1d)/주봉(1wk) : 6시간  — 장중에도 자주 바뀌지 않음
 *   30분봉(30m)         : 10분
 *   5분봉(5m)           : 3분
 *   기타                : 5분
 */

const TTL_MS: Record<string, number> = {
  "1d":  6  * 60 * 60 * 1000,
  "1wk": 6  * 60 * 60 * 1000,
  "30m": 10 * 60 * 1000,
  "5m":  3  * 60 * 1000,
};
const DEFAULT_TTL = 5 * 60 * 1000;

function getTTL(interval: string) {
  return TTL_MS[interval] ?? DEFAULT_TTL;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker   = searchParams.get("ticker")   ?? "";
  const range    = searchParams.get("range")    ?? "1y";
  const interval = searchParams.get("interval") ?? "1d";

  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  // ── 1. DB 캐시 조회 ────────────────────────────────────────────────────────
  try {
    const cached = await prisma.stockChartCache.findUnique({
      where: { ticker_interval_range: { ticker, interval, range } },
    });
    if (cached) {
      const age = Date.now() - cached.fetchedAt.getTime();
      if (age < getTTL(interval)) {
        return NextResponse.json({ ...(cached.meta as object), bars: cached.bars, fromCache: true });
      }
    }
  } catch { /* DB 조회 실패 시 Yahoo에서 직접 가져옴 */ }

  // ── 2. Yahoo Finance 요청 ───────────────────────────────────────────────────
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json({ error: `Yahoo Finance ${res.status}` }, { status: res.status });

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return NextResponse.json({ error: "No data" }, { status: 404 });

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};

    // 분봉은 ISO 타임스탬프, 일봉은 YYYY-MM-DD
    const isDailyOrWeekly = interval === "1d" || interval === "1wk";
    const bars = timestamps
      .map((ts, i) => ({
        date: isDailyOrWeekly
          ? new Date(ts * 1000).toISOString().slice(0, 10)
          : new Date(ts * 1000).toISOString(),
        open:   quote.open?.[i]   as number | null,
        high:   quote.high?.[i]   as number | null,
        low:    quote.low?.[i]    as number | null,
        close:  quote.close?.[i]  as number | null,
        volume: quote.volume?.[i] as number | null,
      }))
      .filter(b => b.open != null && b.close != null && b.high != null && b.low != null)
      .map(b => ({
        date:   b.date,
        open:   Math.round((b.open  ?? 0) * 100) / 100,
        high:   Math.round((b.high  ?? 0) * 100) / 100,
        low:    Math.round((b.low   ?? 0) * 100) / 100,
        close:  Math.round((b.close ?? 0) * 100) / 100,
        volume: b.volume ?? 0,
      }));

    const m = result.meta ?? {};
    const meta = {
      ticker:              m.symbol             ?? ticker,
      currency:            m.currency           ?? "USD",
      regularMarketPrice:  m.regularMarketPrice  ?? null,
      previousClose:       m.chartPreviousClose  ?? null,
      longName:            m.longName ?? m.shortName ?? ticker,
    };

    // ── 3. DB에 저장 (백그라운드 — 실패해도 응답엔 영향 없음) ──────────────
    prisma.stockChartCache.upsert({
      where:  { ticker_interval_range: { ticker, interval, range } },
      create: { ticker, interval, range, bars, meta },
      update: { bars, meta, fetchedAt: new Date() },
    }).catch(() => {});

    return NextResponse.json({ ...meta, bars });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
