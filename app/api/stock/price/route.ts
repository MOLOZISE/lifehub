import { NextRequest, NextResponse } from "next/server";

/**
 * Stock price proxy — supports Yahoo Finance (no key required)
 * GET /api/stock/price?tickers=AAPL,005930.KS
 * Returns: { prices: { [ticker]: { price, change, changePercent, currency, name } } }
 */

interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
}

// ── 서버 in-memory 캐시 (1분) ───────────────────────────────────────────────
// 홈 + 주식 페이지 동시 로딩 시 동일 티커 중복 Yahoo 호출 방지
const PRICE_TTL = 60 * 1000;
const priceCache = new Map<string, { data: PriceData; ts: number }>();
// 동시 요청 중복 방지: 같은 티커 진행 중 promise 공유
const fetchingMap = new Map<string, Promise<PriceData | null>>();

async function fetchOneTicker(ticker: string): Promise<PriceData | null> {
  // 캐시 히트
  const cached = priceCache.get(ticker);
  if (cached && Date.now() - cached.ts < PRICE_TTL) return cached.data;

  // 이미 동일 티커 fetch 중이면 같은 promise 공유
  const existing = fetchingMap.get(ticker);
  if (existing) return existing;

  const promise = (async (): Promise<PriceData | null> => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d&includePrePost=false`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return null;

      const price = meta.regularMarketPrice ?? 0;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const result: PriceData = {
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        currency: meta.currency ?? "USD",
        name: meta.longName ?? meta.shortName ?? ticker,
      };
      priceCache.set(ticker, { data: result, ts: Date.now() });
      return result;
    } catch {
      return null;
    } finally {
      fetchingMap.delete(ticker);
    }
  })();

  fetchingMap.set(ticker, promise);
  return promise;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("tickers") ?? "";
  if (!raw) return NextResponse.json({ error: "tickers required" }, { status: 400 });

  const tickers = raw.split(",").map(t => t.trim()).filter(Boolean);
  const entries = await Promise.all(tickers.map(async t => [t, await fetchOneTicker(t)] as const));
  const prices = Object.fromEntries(entries.filter(([, v]) => v !== null)) as Record<string, PriceData>;

  return NextResponse.json({ prices });
}
