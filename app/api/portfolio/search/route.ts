import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchStocks, ALL_POPULAR } from "@/lib/stocks-list";
import type { StockMeta } from "@/lib/stocks-list";

// GET /api/portfolio/search?q=삼성&market=KR
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const market = searchParams.get("market") as "KR" | "US" | undefined;

  // 검색어 없으면 인기 종목 반환
  if (!q.trim()) {
    const popular = market ? ALL_POPULAR.filter(s => s.market === market) : ALL_POPULAR;
    return NextResponse.json(popular.slice(0, 30));
  }

  // 먼저 로컬 리스트 검색
  const localResults = searchStocks(q, market || undefined);

  // 로컬 결과가 있어도 Yahoo Finance 검색도 병행 (로컬에 없는 종목 보완)
  // 단, 완전히 일치하는 로컬 결과가 충분히 많으면(20개 이상) 스킵
  if (localResults.length >= 20) {
    return NextResponse.json(localResults.slice(0, 30));
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0&enableFuzzyQuery=true&lang=ko`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quotes: any[] = data.quotes ?? [];
      const yahooResults: StockMeta[] = quotes
        .filter(q => q.quoteType === "EQUITY" || q.quoteType === "ETF")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any): StockMeta => {
          const symbol: string = item.symbol ?? "";
          let ticker = symbol;
          let m: "KR" | "US" = "US";
          if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) {
            ticker = symbol.replace(/\.(KS|KQ)$/, "");
            m = "KR";
          } else if (symbol.includes(".") && !symbol.match(/^[A-Z]+$/)) {
            // 기타 거래소 (도쿄, 홍콩 등) - 스킵
            return null as unknown as StockMeta;
          }
          return {
            ticker,
            name: item.longname || item.shortname || ticker,
            market: m,
            sector: "other",
          };
        })
        .filter(Boolean)
        .filter(s => !market || s.market === market);

      // 로컬 + 야후 결과 합치기 (중복 제거)
      const seen = new Set(localResults.map(r => r.ticker));
      const merged = [...localResults, ...yahooResults.filter(r => !seen.has(r.ticker))];
      return NextResponse.json(merged.slice(0, 30));
    }
  } catch {
    // Yahoo Finance 실패 시 로컬 결과만 반환
  }

  return NextResponse.json(localResults.slice(0, 30));
}
