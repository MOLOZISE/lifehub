import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrice } from "@/lib/kis";

// GET /api/portfolio/price?ticker=005930&market=KR
// GET /api/portfolio/price?tickers=005930,AAPL,TSLA&markets=KR,NAS,NAS
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  // 단일 종목
  const ticker = searchParams.get("ticker");
  const market = searchParams.get("market") ?? undefined;

  if (ticker) {
    try {
      const price = await getPrice(ticker, market);
      return NextResponse.json(price);
    } catch (e) {
      return NextResponse.json(
        { error: `가격 조회 실패: ${ticker}`, detail: String(e) },
        { status: 502 }
      );
    }
  }

  // 복수 종목 (쉼표 구분)
  const tickersParam = searchParams.get("tickers");
  const marketsParam = searchParams.get("markets");

  if (tickersParam) {
    const tickers = tickersParam.split(",").map((t) => t.trim());
    const markets = marketsParam ? marketsParam.split(",").map((m) => m.trim()) : [];

    const results = await Promise.allSettled(
      tickers.map((t, i) => getPrice(t, markets[i]))
    );

    const prices: Record<string, unknown> = {};
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        prices[tickers[i]] = result.value;
      } else {
        prices[tickers[i]] = { error: String(result.reason) };
      }
    });

    return NextResponse.json(prices);
  }

  return NextResponse.json({ error: "ticker 또는 tickers 파라미터 필요" }, { status: 400 });
}
