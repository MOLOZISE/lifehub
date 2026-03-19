import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { MarketItem } from "@/lib/market-symbols";
import { ALL_SYMBOLS, DEFAULT_SYMBOLS } from "@/lib/market-symbols";
export type { MarketItem } from "@/lib/market-symbols";
export { ALL_SYMBOLS, DEFAULT_SYMBOLS };

// In-memory cache (서버 재시작 전까지 유효)
let memCache: { data: Record<string, MarketItem>; ts: number } | null = null;
const MEM_CACHE_TTL = 5 * 60 * 1000; // 5분

async function fetchYahooQuotes(symbols: string[]): Promise<Record<string, MarketItem>> {
  if (symbols.length === 0) return {};
  const joined = symbols.join(",");
  const url = `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${joined}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Yahoo Finance 응답 오류: ${res.status}`);

  const json = await res.json();
  const quotes: Record<string, MarketItem> = {};

  for (const q of json?.quoteResponse?.result ?? []) {
    const meta = ALL_SYMBOLS.find(s => s.symbol === q.symbol);
    if (!meta) continue;
    quotes[q.symbol] = {
      symbol: q.symbol,
      label: meta.label,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changeRate: q.regularMarketChangePercent ?? 0,
      currency: meta.currency,
      type: meta.type,
    };
  }
  return quotes;
}

async function loadFromDb(): Promise<{ data: Record<string, MarketItem>; ts: number } | null> {
  try {
    const row = await prisma.marketCache.findUnique({ where: { id: "singleton" } });
    if (!row) return null;
    return { data: row.data as unknown as Record<string, MarketItem>, ts: row.updatedAt.getTime() };
  } catch {
    return null;
  }
}

async function saveToDb(data: Record<string, MarketItem>) {
  try {
    await prisma.marketCache.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", data: data as never },
      update: { data: data as never },
    });
  } catch {
    // DB 저장 실패는 무시 (in-memory로 fallback)
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";
  // 사용자가 요청한 종목 리스트 (없으면 default)
  const symbolsParam = url.searchParams.get("symbols");
  const requestedSymbols = symbolsParam
    ? symbolsParam.split(",").filter(s => ALL_SYMBOLS.some(a => a.symbol === s))
    : DEFAULT_SYMBOLS;

  // force가 아니면 in-memory 캐시 먼저 확인
  if (!force && memCache && Date.now() - memCache.ts < MEM_CACHE_TTL) {
    const filtered = Object.fromEntries(
      Object.entries(memCache.data).filter(([k]) => requestedSymbols.includes(k))
    );
    return NextResponse.json({ data: filtered, cached: true, cachedAt: memCache.ts });
  }

  // DB 캐시 확인 (서버 재시작 후 복원용)
  if (!force && !memCache) {
    const dbCache = await loadFromDb();
    if (dbCache && Date.now() - dbCache.ts < MEM_CACHE_TTL) {
      memCache = dbCache;
      const filtered = Object.fromEntries(
        Object.entries(dbCache.data).filter(([k]) => requestedSymbols.includes(k))
      );
      return NextResponse.json({ data: filtered, cached: true, cachedAt: dbCache.ts });
    }
  }

  // 전체 default 종목 fetch (캐시는 전체 기준으로 저장)
  try {
    const data = await fetchYahooQuotes(DEFAULT_SYMBOLS);
    memCache = { data, ts: Date.now() };
    // DB에 비동기로 저장
    saveToDb(data);

    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k]) => requestedSymbols.includes(k))
    );
    return NextResponse.json({ data: filtered, cached: false, cachedAt: memCache.ts });
  } catch (e) {
    // 캐시 fallback
    const fallback = memCache ?? (await loadFromDb());
    if (fallback) {
      const filtered = Object.fromEntries(
        Object.entries(fallback.data).filter(([k]) => requestedSymbols.includes(k))
      );
      return NextResponse.json({ data: filtered, cached: true, cachedAt: fallback.ts, stale: true });
    }
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
