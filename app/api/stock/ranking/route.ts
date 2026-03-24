import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0; // 서버 캐시는 in-memory로 직접 관리

const POPULAR_KR = [
  "005930.KS","000660.KS","035420.KS","005380.KS","051910.KS",
  "006400.KS","035720.KS","207940.KS","068270.KS","000270.KS",
  "096770.KS","034020.KS","003550.KS","028260.KS","012330.KS",
  "066570.KS","009830.KS","032830.KS","105560.KS","086790.KS",
];

const POPULAR_US = [
  "AAPL","NVDA","MSFT","GOOGL","AMZN","META","TSLA","TSM",
  "AMD","INTC","NFLX","ORCL","QCOM","MU","AVGO","PLTR",
  "SPY","QQQ","SOFI","COIN",
];

interface RankItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  currency: string;
}

// ── 서버 in-memory 캐시 (5분) ───────────────────────────────────────────────
// 20개 심볼 개별 Yahoo 호출을 매 요청마다 반복하지 않도록
const RANK_TTL = 5 * 60 * 1000;
const rankCache: Record<"KR" | "US", { items: RankItem[]; ts: number }> = {
  KR: { items: [], ts: 0 },
  US: { items: [], ts: 0 },
};
// 동시 요청 중복 방지: 이미 진행 중인 fetch promise 공유
const fetchingPromise: Record<"KR" | "US", Promise<RankItem[]> | null> = {
  KR: null,
  US: null,
};

// v7/finance/quote는 crumb 인증이 필요해 서버에서 자주 막힘
// v8/finance/chart는 crumb 없이도 동작 — 심볼별 병렬 호출로 대체
async function fetchOneChart(symbol: string): Promise<RankItem | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    const price = meta.regularMarketPrice as number;
    const prevClose = (meta.chartPreviousClose ?? meta.previousClose ?? price) as number;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return {
      ticker: symbol.replace(".KS", ""),
      name: (meta.longName ?? meta.shortName ?? symbol) as string,
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume: (meta.regularMarketVolume ?? 0) as number,
      currency: (meta.currency ?? "USD") as string,
    };
  } catch {
    return null;
  }
}

async function fetchAllQuotes(market: "KR" | "US"): Promise<RankItem[]> {
  // 이미 진행 중인 요청이 있으면 동일 promise 공유 (중복 호출 방지)
  if (fetchingPromise[market]) return fetchingPromise[market]!;

  const symbols = market === "KR" ? POPULAR_KR : POPULAR_US;
  fetchingPromise[market] = Promise.all(symbols.map(fetchOneChart))
    .then(results => results.filter((r): r is RankItem => r !== null))
    .finally(() => { fetchingPromise[market] = null; });

  return fetchingPromise[market]!;
}

function sortItems(items: RankItem[], sort: string): RankItem[] {
  return [...items].sort((a, b) => {
    if (sort === "change_up") return b.changePercent - a.changePercent;
    if (sort === "change_down") return a.changePercent - b.changePercent;
    return b.volume - a.volume;
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get("market") === "KR" ? "KR" : "US";
  const sort = searchParams.get("sort") ?? "volume";

  const cache = rankCache[market];

  // 캐시 유효 → sort만 적용해 즉시 반환 (Yahoo 호출 0번)
  if (cache.ts > 0 && Date.now() - cache.ts < RANK_TTL && cache.items.length > 0) {
    return NextResponse.json({ items: sortItems(cache.items, sort).slice(0, 20), market, sort, cached: true });
  }

  try {
    const items = await fetchAllQuotes(market);
    if (items.length > 0) {
      rankCache[market] = { items, ts: Date.now() };
    }
    const fallback = items.length > 0 ? items : cache.items; // fetch 실패 시 이전 캐시 활용
    return NextResponse.json({ items: sortItems(fallback, sort).slice(0, 20), market, sort });
  } catch (e) {
    if (cache.items.length > 0) {
      return NextResponse.json({ items: sortItems(cache.items, sort).slice(0, 20), market, sort, stale: true });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
