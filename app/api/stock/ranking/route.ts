import { NextRequest, NextResponse } from "next/server";

export const revalidate = 300; // 5분 캐시

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
      next: { revalidate: 300 },
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

async function fetchQuotes(symbols: string[]): Promise<RankItem[]> {
  const results = await Promise.all(symbols.map(fetchOneChart));
  return results.filter((r): r is RankItem => r !== null);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get("market") === "KR" ? "KR" : "US";
  const sort = searchParams.get("sort") ?? "volume"; // volume | change_up | change_down

  const symbols = market === "KR" ? POPULAR_KR : POPULAR_US;

  try {
    const items = await fetchQuotes(symbols);
    const sorted = [...items].sort((a, b) => {
      if (sort === "change_up") return b.changePercent - a.changePercent;
      if (sort === "change_down") return a.changePercent - b.changePercent;
      return b.volume - a.volume; // volume (default)
    });
    return NextResponse.json({ items: sorted.slice(0, 20), market, sort });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
