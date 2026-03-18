import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Yahoo Finance quoteSummary proxy
 * GET /api/stock/info?ticker=AAPL&market=US
 * GET /api/stock/info?ticker=005930&market=KR
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const ticker = searchParams.get("ticker") ?? "";
  const market = searchParams.get("market") ?? "US";

  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const yahooTicker = market === "KR" || /^\d{6}$/.test(ticker) ? `${ticker}.KS` : ticker.toUpperCase();

  try {
    const modules = "price,summaryDetail,defaultKeyStatistics,financialData";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooTicker)}?modules=${modules}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo Finance ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) return NextResponse.json({ error: "데이터 없음" }, { status: 404 });

    const p = result.price ?? {};
    const sd = result.summaryDetail ?? {};
    const ks = result.defaultKeyStatistics ?? {};
    const fd = result.financialData ?? {};

    return NextResponse.json({
      name: p.longName ?? p.shortName ?? ticker,
      currency: p.currency ?? "USD",
      regularMarketPrice: p.regularMarketPrice?.raw ?? null,
      regularMarketChange: p.regularMarketChange?.raw ?? null,
      regularMarketChangePercent: p.regularMarketChangePercent?.raw ?? null,
      regularMarketOpen: p.regularMarketOpen?.raw ?? null,
      regularMarketDayHigh: p.regularMarketDayHigh?.raw ?? null,
      regularMarketDayLow: p.regularMarketDayLow?.raw ?? null,
      regularMarketVolume: p.regularMarketVolume?.raw ?? null,
      regularMarketPreviousClose: p.regularMarketPreviousClose?.raw ?? null,
      marketCap: p.marketCap?.raw ?? null,
      marketCapFmt: p.marketCap?.fmt ?? null,
      fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh?.raw ?? null,
      fiftyTwoWeekLow: sd.fiftyTwoWeekLow?.raw ?? null,
      dividendYield: sd.dividendYield?.raw ?? null,
      trailingPE: sd.trailingPE?.raw ?? null,
      beta: sd.beta?.raw ?? null,
      priceToBook: ks.priceToBook?.raw ?? null,
      trailingEps: ks.trailingEps?.raw ?? null,
      forwardEps: ks.forwardEps?.raw ?? null,
      targetMeanPrice: fd.targetMeanPrice?.raw ?? null,
      recommendationKey: fd.recommendationKey ?? null,
      numberOfAnalystOpinions: fd.numberOfAnalystOpinions?.raw ?? null,
      revenueGrowth: fd.revenueGrowth?.raw ?? null,
      grossMargins: fd.grossMargins?.raw ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
