import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { MarketItem } from "@/lib/market-symbols";
import { ALL_SYMBOLS, DEFAULT_SYMBOLS } from "@/lib/market-symbols";
import { getKrIndex, getUsIndex, getUsPrice, getKrPrice } from "@/lib/kis";
export type { MarketItem } from "@/lib/market-symbols";
export { ALL_SYMBOLS, DEFAULT_SYMBOLS };

// In-memory cache
let memCache: { data: Record<string, MarketItem>; ts: number } | null = null;
const MEM_CACHE_TTL = 5 * 60 * 1000; // 5분

// KIS 커버 심볼 매핑
const KIS_INDEX_MAP: Record<string, { type: "kr" | "us"; code: string }> = {
  "^KS11": { type: "kr", code: "0001" },
  "^KQ11": { type: "kr", code: "1001" },
  "^IXIC": { type: "us", code: "N0100" },
  "^GSPC": { type: "us", code: "N0300" },
  "^DJI":  { type: "us", code: "N0400" },
};

const KIS_STOCK_MAP: Record<string, { market: "KR" | "US" }> = {
  "MU":   { market: "US" }, "WDC":  { market: "US" },
  "NVDA": { market: "US" }, "AAPL": { market: "US" },
  "TSLA": { market: "US" },
};

// Yahoo Finance chart API 폴백 (FX, 원자재, 채권용)
async function fetchYahooOne(sym: typeof ALL_SYMBOLS[number]): Promise<MarketItem | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym.symbol)}?range=1d&interval=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const changeRate = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return {
      symbol: sym.symbol,
      label: sym.label,
      price,
      change: Math.round(change * 100) / 100,
      changeRate: Math.round(changeRate * 100) / 100,
      currency: sym.currency,
      type: sym.type,
    };
  } catch {
    return null;
  }
}

async function fetchAllSymbols(): Promise<{ data: Record<string, MarketItem>; errors: string[] }> {
  const errors: string[] = [];
  const data: Record<string, MarketItem> = {};

  const tasks = DEFAULT_SYMBOLS.map(async (symbol) => {
    const meta = ALL_SYMBOLS.find(s => s.symbol === symbol);
    if (!meta) return;

    // KIS 지수
    if (KIS_INDEX_MAP[symbol]) {
      const { type, code } = KIS_INDEX_MAP[symbol];
      try {
        const result = type === "kr" ? await getKrIndex(code) : await getUsIndex(code);
        data[symbol] = {
          symbol,
          label: meta.label,
          price: result.price,
          change: result.change,
          changeRate: result.changeRate,
          currency: meta.currency,
          type: meta.type,
        };
        return;
      } catch (e) {
        const msg = String(e);
        if (msg.includes("분당") || msg.includes("EGW00133") || msg.includes("초당 거래건수") || msg.includes("429")) {
          errors.push(`${meta.label} (KIS 요청 한도)`);
        } else if (msg.includes("인증 실패") || msg.includes("토큰")) {
          errors.push(`${meta.label} (KIS 인증 오류)`);
        } else {
          errors.push(`${meta.label} (조회 실패)`);
        }
        // 폴백: Yahoo Finance
      }
    }

    // KIS 주식
    if (KIS_STOCK_MAP[symbol]) {
      const { market } = KIS_STOCK_MAP[symbol];
      try {
        const result = market === "KR" ? await getKrPrice(symbol) : await getUsPrice(symbol);
        data[symbol] = {
          symbol,
          label: meta.label,
          price: result.price,
          change: result.change,
          changeRate: result.changeRate,
          currency: meta.currency,
          type: meta.type,
        };
        return;
      } catch (e) {
        const msg = String(e);
        if (msg.includes("분당") || msg.includes("EGW00133") || msg.includes("초당 거래건수") || msg.includes("429")) {
          errors.push(`${meta.label} (KIS 요청 한도)`);
        } else if (msg.includes("인증 실패") || msg.includes("토큰")) {
          errors.push(`${meta.label} (KIS 인증 오류)`);
        } else {
          errors.push(`${meta.label} (조회 실패)`);
        }
        // 폴백: Yahoo Finance
      }
    }

    // Yahoo Finance (FX, 원자재, 채권 + 위 KIS 실패 폴백)
    if (!(symbol in data)) {
      const result = await fetchYahooOne(meta);
      if (result) {
        data[symbol] = result;
      } else {
        errors.push(`${meta.label}: 데이터 조회 실패`);
      }
    }
  });

  await Promise.all(tasks);
  return { data, errors };
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
  } catch { /* 무시 */ }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";
  const symbolsParam = url.searchParams.get("symbols");
  const requestedSymbols = symbolsParam
    ? symbolsParam.split(",").filter(s => ALL_SYMBOLS.some(a => a.symbol === s))
    : DEFAULT_SYMBOLS;

  // 1. 캐시 확인 (force 아닌 경우) — 캐시 있으면 바로 반환
  if (!force) {
    // in-memory 캐시
    if (memCache && Date.now() - memCache.ts < MEM_CACHE_TTL) {
      const filtered = Object.fromEntries(
        Object.entries(memCache.data).filter(([k]) => requestedSymbols.includes(k))
      );
      return NextResponse.json({ data: filtered, cached: true, cachedAt: memCache.ts });
    }
    // DB 캐시
    const dbCache = await loadFromDb();
    if (dbCache && Date.now() - dbCache.ts < MEM_CACHE_TTL) {
      memCache = dbCache;
      const filtered = Object.fromEntries(
        Object.entries(dbCache.data).filter(([k]) => requestedSymbols.includes(k))
      );
      return NextResponse.json({ data: filtered, cached: true, cachedAt: dbCache.ts });
    }

    // 캐시가 만료됐어도 DB에 이전 데이터 있으면 반환하면서 백그라운드 갱신
    if (dbCache && Object.keys(dbCache.data).length > 0) {
      // 백그라운드에서 갱신 (응답은 stale 데이터로 즉시)
      fetchAllSymbols().then(({ data }) => {
        if (Object.keys(data).length > 0) {
          memCache = { data, ts: Date.now() };
          saveToDb(data);
        }
      }).catch(() => {});

      const filtered = Object.fromEntries(
        Object.entries(dbCache.data).filter(([k]) => requestedSymbols.includes(k))
      );
      return NextResponse.json({
        data: filtered,
        cached: true,
        stale: true,
        cachedAt: dbCache.ts,
      });
    }
  }

  // 2. 신규 fetch
  try {
    const { data, errors } = await fetchAllSymbols();

    if (Object.keys(data).length > 0) {
      memCache = { data, ts: Date.now() };
      saveToDb(data);
    }

    // 일부 실패해도 DB 과거 데이터와 병합
    let merged = data;
    if (errors.length > 0) {
      const dbCache = await loadFromDb();
      if (dbCache) {
        merged = { ...dbCache.data, ...data }; // 신규 성공 데이터 우선
      }
    }

    const filtered = Object.fromEntries(
      Object.entries(merged).filter(([k]) => requestedSymbols.includes(k))
    );

    return NextResponse.json({
      data: filtered,
      cached: false,
      cachedAt: memCache?.ts ?? Date.now(),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    // 완전 실패 — DB/메모리 캐시 반환
    const fallback = memCache ?? (await loadFromDb());
    const errorMsg = String(e);
    const reason = errorMsg.includes("분당") || errorMsg.includes("EGW00133") || errorMsg.includes("429")
      ? "KIS API 요청 한도 초과 (분당 1회)"
      : errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")
      ? "API 서버 응답 시간 초과"
      : "외부 API 오류";

    if (fallback && Object.keys(fallback.data).length > 0) {
      const filtered = Object.fromEntries(
        Object.entries(fallback.data).filter(([k]) => requestedSymbols.includes(k))
      );
      return NextResponse.json({
        data: filtered,
        cached: true,
        stale: true,
        cachedAt: fallback.ts,
        fetchError: `${reason} — 이전 저장 데이터를 표시합니다`,
      });
    }

    return NextResponse.json({
      data: {},
      error: reason,
      fetchError: `${reason} — 저장된 데이터도 없습니다. 잠시 후 다시 시도해주세요.`,
    }, { status: 502 });
  }
}
