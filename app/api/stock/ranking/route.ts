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

async function fetchQuotes(symbols: string[]): Promise<RankItem[]> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,currency`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const data = await res.json() as {
    quoteResponse?: { result?: Array<{
      symbol: string; shortName?: string; longName?: string;
      regularMarketPrice?: number; regularMarketChange?: number;
      regularMarketChangePercent?: number; regularMarketVolume?: number;
      currency?: string;
    }> };
  };
  const results = data?.quoteResponse?.result ?? [];
  return results
    .filter(r => r.regularMarketPrice != null)
    .map(r => ({
      ticker: r.symbol.replace(".KS", ""),
      name: r.shortName ?? r.longName ?? r.symbol,
      price: r.regularMarketPrice ?? 0,
      change: r.regularMarketChange ?? 0,
      changePercent: r.regularMarketChangePercent ?? 0,
      volume: r.regularMarketVolume ?? 0,
      currency: r.currency ?? "USD",
    }));
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
