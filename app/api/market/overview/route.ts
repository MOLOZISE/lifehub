import { NextResponse } from "next/server";
import { auth } from "@/auth";

// In-memory cache: 5분
let cache: { data: Record<string, MarketItem>; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export interface MarketItem {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changeRate: number;
  currency: string;
  type: "index" | "fx" | "commodity" | "stock";
}

const SYMBOLS: { symbol: string; label: string; currency: string; type: MarketItem["type"] }[] = [
  { symbol: "^IXIC",   label: "나스닥",   currency: "pt",  type: "index" },
  { symbol: "^GSPC",   label: "S&P 500", currency: "pt",  type: "index" },
  { symbol: "^DJI",    label: "다우존스", currency: "pt",  type: "index" },
  { symbol: "USDKRW=X",label: "원/달러", currency: "KRW", type: "fx" },
  { symbol: "CL=F",    label: "WTI 유가", currency: "USD", type: "commodity" },
  { symbol: "GC=F",    label: "금",       currency: "USD", type: "commodity" },
  { symbol: "MU",      label: "마이크론", currency: "USD", type: "stock" },
  { symbol: "WDC",     label: "웨스턴디지털", currency: "USD", type: "stock" },
];

async function fetchYahooQuotes(symbols: string[]): Promise<Record<string, MarketItem>> {
  const joined = symbols.join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LifeHub/1.0)",
      "Accept": "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`Yahoo Finance 응답 오류: ${res.status}`);

  const json = await res.json();
  const quotes: Record<string, MarketItem> = {};

  for (const q of json?.quoteResponse?.result ?? []) {
    const meta = SYMBOLS.find(s => s.symbol === q.symbol);
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 캐시 유효하면 바로 반환
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ data: cache.data, cached: true, cachedAt: cache.ts });
  }

  try {
    const data = await fetchYahooQuotes(SYMBOLS.map(s => s.symbol));
    cache = { data, ts: Date.now() };
    return NextResponse.json({ data, cached: false, cachedAt: cache.ts });
  } catch (e) {
    // 캐시가 있으면 만료돼도 반환
    if (cache) return NextResponse.json({ data: cache.data, cached: true, cachedAt: cache.ts });
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
