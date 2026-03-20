import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Yahoo Finance OHLCV proxy with DB cache + 기술적 지표 계산.
 * GET /api/chart?ticker=AAPL&range=1y&interval=1d
 *
 * TTL 전략:
 *   일봉(1d)/주봉(1wk) : 6시간
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
function getTTL(interval: string) { return TTL_MS[interval] ?? DEFAULT_TTL; }

// ── 기술적 지표 계산 ─────────────────────────────────────────────────────────

function calcMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(-(period + 1));
  const changes = slice.slice(1).map((v, i) => v - slice[i]);
  const avgGain = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  const avgLoss = changes.filter(c => c < 0).map(c => -c).reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcMACD(closes: number[]): { macdLine: number | null; signalLine: number | null } {
  if (closes.length < 35) return { macdLine: null, signalLine: null };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdValues = ema12.map((v, i) => v - ema26[i]).slice(25);
  if (macdValues.length < 9) return { macdLine: macdValues.at(-1) ?? null, signalLine: null };
  const signal = calcEMA(macdValues, 9);
  return { macdLine: macdValues.at(-1) ?? null, signalLine: signal.at(-1) ?? null };
}

function calcBollinger(closes: number[], period = 20): { upper: number; mid: number; lower: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.map(v => (v - mid) ** 2).reduce((a, b) => a + b, 0) / period);
  return { upper: mid + 2 * std, mid, lower: mid - 2 * std };
}

interface Technicals {
  ma5: number | null; ma20: number | null; ma60: number | null;
  rsi14: number | null;
  macdLine: number | null; signalLine: number | null;
  bbUpper: number | null; bbMid: number | null; bbLower: number | null;
}

function computeTechnicals(closes: number[]): Technicals {
  const bb = calcBollinger(closes);
  const { macdLine, signalLine } = calcMACD(closes);
  return {
    ma5:  calcMA(closes, 5),
    ma20: calcMA(closes, 20),
    ma60: calcMA(closes, 60),
    rsi14: calcRSI(closes, 14),
    macdLine, signalLine,
    bbUpper: bb?.upper ?? null,
    bbMid:   bb?.mid   ?? null,
    bbLower: bb?.lower ?? null,
  };
}

function genTechSummary(t: Technicals, lastClose: number): string {
  const signals: string[] = [];

  // MA 정배열 / 역배열
  if (t.ma5 && t.ma20 && t.ma60) {
    if (t.ma5 > t.ma20 && t.ma20 > t.ma60) signals.push("이동평균선 정배열 상태로 상승 추세");
    else if (t.ma5 < t.ma20 && t.ma20 < t.ma60) signals.push("이동평균선 역배열 상태로 하락 추세");
    else if (t.ma5 > t.ma20) signals.push("단기 이동평균선 상향 돌파");
    else signals.push("단기 이동평균선 하향 이탈");
  }

  // RSI
  if (t.rsi14 != null) {
    const r = Math.round(t.rsi14);
    if (r > 70) signals.push(`RSI ${r} 과매수 구간 진입`);
    else if (r < 30) signals.push(`RSI ${r} 과매도 구간 — 반등 주목`);
    else if (r > 55) signals.push(`RSI ${r} 강세 유지`);
    else if (r < 45) signals.push(`RSI ${r} 약세`);
    else signals.push(`RSI ${r} 중립`);
  }

  // MACD
  if (t.macdLine != null && t.signalLine != null) {
    signals.push(t.macdLine > t.signalLine ? "MACD 매수 신호" : "MACD 매도 신호");
  }

  // 볼린저 밴드
  if (t.bbUpper && t.bbLower) {
    if (lastClose > t.bbUpper) signals.push("볼린저 밴드 상단 돌파");
    else if (lastClose < t.bbLower) signals.push("볼린저 밴드 하단 이탈");
  }

  return signals.join(" · ") || "기술적 지표 분석 완료";
}

// ── Route ────────────────────────────────────────────────────────────────────

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
    const baseMeta = {
      ticker:             m.symbol             ?? ticker,
      currency:           m.currency           ?? "USD",
      regularMarketPrice: m.regularMarketPrice  ?? null,
      previousClose:      m.chartPreviousClose  ?? null,
      longName:           m.longName ?? m.shortName ?? ticker,
    };

    // ── 3. 기술적 지표 계산 (일봉/주봉만, bars 충분할 때) ─────────────────────
    let technicals: Technicals | null = null;
    let techSummary: string | null = null;
    if ((interval === "1d" || interval === "1wk") && bars.length >= 20) {
      const closes = bars.map(b => b.close);
      technicals = computeTechnicals(closes);
      techSummary = genTechSummary(technicals, closes.at(-1) ?? 0);
    }

    const meta = { ...baseMeta, ...(technicals ? { technicals, techSummary } : {}) };

    // ── 4. DB에 저장 (백그라운드) ──────────────────────────────────────────────
    prisma.stockChartCache.upsert({
      where:  { ticker_interval_range: { ticker, interval, range } },
      create: { ticker, interval, range, bars: bars as never, meta: meta as never },
      update: { bars: bars as never, meta: meta as never, fetchedAt: new Date() },
    }).catch(() => {});

    return NextResponse.json({ ...meta, bars });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
