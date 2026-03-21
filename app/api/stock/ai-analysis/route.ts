import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";

const ANALYSIS_TTL_MS = 72 * 60 * 60 * 1000; // 72시간

// ── 1. 룰 기반 기술적 분석 ─────────────────────────────────────────────────────
// Groq 없이 DB의 기술적 지표로 즉시 신호 계산

interface Technicals {
  ma5?: number; ma20?: number; ma60?: number;
  rsi14?: number;
  macd?: number; macdSignal?: number; macdHist?: number;
  bbUpper?: number; bbMiddle?: number; bbLower?: number;
}

interface RuleSignal {
  score: number;        // -6 ~ +6
  opinion: string;      // 매수 / 중립 / 매도
  risk: string;         // 상 / 중 / 하
  bullish: string[];    // 긍정 요인
  bearish: string[];    // 부정 요인
  techSummary: string;  // 한 줄 기술적 요약
}

function computeRuleSignal(t: Technicals, lastClose?: number): RuleSignal {
  let score = 0;
  const bullish: string[] = [];
  const bearish: string[] = [];

  // MA 크로스
  if (t.ma5 && t.ma20) {
    if (t.ma5 > t.ma20) { score += 2; bullish.push(`단기 상승추세 (MA5 ${t.ma5.toFixed(0)} > MA20 ${t.ma20.toFixed(0)})`); }
    else                 { score -= 2; bearish.push(`단기 하락추세 (MA5 ${t.ma5.toFixed(0)} < MA20 ${t.ma20.toFixed(0)})`); }
  }
  if (t.ma20 && t.ma60) {
    if (t.ma20 > t.ma60) { score += 1; bullish.push("중기 정배열"); }
    else                  { score -= 1; bearish.push("중기 역배열"); }
  }

  // RSI
  if (t.rsi14 != null) {
    const r = t.rsi14;
    if (r >= 70)       { score -= 2; bearish.push(`RSI ${r.toFixed(0)} 과매수`); }
    else if (r <= 30)  { score += 2; bullish.push(`RSI ${r.toFixed(0)} 과매도(반등 기대)`); }
    else if (r >= 55)  { score += 1; bullish.push(`RSI ${r.toFixed(0)} 강세권`); }
    else if (r <= 45)  { score -= 1; bearish.push(`RSI ${r.toFixed(0)} 약세권`); }
  }

  // MACD
  if (t.macd != null && t.macdSignal != null) {
    if (t.macd > t.macdSignal) { score += 1; bullish.push("MACD 골든크로스"); }
    else                        { score -= 1; bearish.push("MACD 데드크로스"); }
  }

  // 볼린저 밴드 (현재가 기준)
  if (lastClose && t.bbUpper && t.bbLower && t.bbMiddle) {
    const pos = (lastClose - t.bbLower) / (t.bbUpper - t.bbLower);
    if (pos >= 0.85)      { score -= 1; bearish.push("볼린저 상단 근접 (과열)"); }
    else if (pos <= 0.15) { score += 1; bullish.push("볼린저 하단 근접 (지지)"); }
  }

  const opinion = score >= 3 ? "매수" : score <= -3 ? "매도" : "중립";
  const risk    = score >= 4 || score <= -4 ? "중" : "하";

  const techSummary = [
    t.ma5 && t.ma20 ? (t.ma5 > t.ma20 ? "이평 정배열" : "이평 역배열") : null,
    t.rsi14 != null ? `RSI ${t.rsi14.toFixed(0)}` : null,
    t.macd != null && t.macdSignal != null ? (t.macd > t.macdSignal ? "MACD 매수" : "MACD 매도") : null,
  ].filter(Boolean).join(" · ");

  return { score, opinion, risk, bullish, bearish, techSummary };
}

// ── 2. Tavily 뉴스 (제목만, 3초 타임아웃) ─────────────────────────────────────

async function fetchHeadlines(name: string): Promise<string[]> {
  if (!process.env.TAVILY_API_KEY) return [];
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const result = await Promise.race([
      client.search(`${name} 주식 뉴스`, {
        searchDepth: "basic", maxResults: 5, includeAnswer: false, days: 7,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    return (result.results ?? []).map(r => {
      const pub = (r as { published_date?: string }).published_date?.slice(0, 10) ?? "";
      return `${r.title}${pub ? ` (${pub})` : ""}`;
    });
  } catch { return []; }
}

// ── 3. Groq (소형 모델, 최소 토큰) ──────────────────────────────────────────────

const MINI_SYSTEM = `주식 애널리스트 AI. 기술적 분석 신호와 뉴스 헤드라인을 종합해 다음 형식으로만 응답하세요:

호재: [한 줄, 없으면 "특이사항 없음"]
악재: [한 줄, 없으면 "특이사항 없음"]
투자의견: [매수/중립/매도]
리스크: [상/중/하]
한 줄 요약: [30자 이내 핵심 판단]`;

async function runMiniAnalysis(name: string, ticker: string, signal: RuleSignal, headlines: string[]) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });

  const newsBlock = headlines.length > 0
    ? `\n\n최근 뉴스:\n${headlines.slice(0, 4).map((h, i) => `${i + 1}. ${h}`).join("\n")}`
    : "";

  const userMsg = `종목: ${name}(${ticker})

기술적 분석 신호 (점수 ${signal.score > 0 ? "+" : ""}${signal.score}/6):
- 긍정: ${signal.bullish.join(", ") || "없음"}
- 부정: ${signal.bearish.join(", ") || "없음"}
- 기술적 소견: ${signal.opinion}${newsBlock}

위를 종합하여 투자의견을 제시하세요.`;

  const chat = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant", // 고속 소형 모델 (TPM 한도 5배 이상)
    messages: [
      { role: "system", content: MINI_SYSTEM },
      { role: "user",   content: userMsg },
    ],
    max_tokens: 300,
    temperature: 0.3,
  });

  return chat.choices[0]?.message?.content ?? "";
}

// ── 4. 응답 파싱 ──────────────────────────────────────────────────────────────

function parseMiniResponse(text: string, signal: RuleSignal) {
  const line = (key: string) => {
    const match = text.match(new RegExp(`${key}[:：]\\s*(.+)`));
    return match?.[1]?.trim() ?? null;
  };

  // AI 의견이 없으면 룰 기반 신호로 폴백
  const opinion    = line("투자의견") ?? signal.opinion;
  const risk       = line("리스크")   ?? signal.risk;
  const summary    = line("한 줄 요약") ?? signal.techSummary;
  const bullish    = line("호재") ?? signal.bullish[0] ?? null;
  const bearish    = line("악재") ?? signal.bearish[0] ?? null;

  // sections 형식 (기존 UI 호환)
  const sections = [
    { type: "positive", title: "호재 요인",     items: bullish ? [bullish] : signal.bullish },
    { type: "negative", title: "악재 요인",     items: bearish ? [bearish] : signal.bearish },
    { type: "neutral",  title: "기술적 지표",   items: [signal.techSummary].filter(Boolean) },
    { type: "summary",  title: "종합 투자의견", items: [
        `투자의견: ${opinion}`, `리스크: ${risk}`, `한 줄 요약: ${summary ?? ""}`,
      ],
      text: text,
    },
  ];

  return { opinion, risk, summary, sections };
}

// ── GET: 캐시 조회 ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker") ?? "";
  const namesParam = url.searchParams.get("names") ?? "";

  // 복수 종목 요약 조회 (포트폴리오 카드용)
  if (namesParam) {
    const names = namesParam.split(",").map(s => s.trim()).filter(Boolean);
    if (!names.length) return NextResponse.json({});
    try {
      const rows = await prisma.stockAiAnalysis.findMany({ where: { ticker: { in: names } } });
      const result: Record<string, unknown> = {};
      for (const row of rows) {
        result[row.ticker] = {
          opinion: row.opinion, targetPrice: row.targetPrice,
          risk: row.risk, summary: row.summary,
          analyzedAt: row.analyzedAt.toISOString(),
          stale: Date.now() - row.analyzedAt.getTime() > ANALYSIS_TTL_MS,
        };
      }
      return NextResponse.json(result);
    } catch { return NextResponse.json({}); }
  }

  // 단일 종목 전체 조회
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  try {
    const row = await prisma.stockAiAnalysis.findUnique({ where: { ticker } });
    if (!row) return NextResponse.json({ cached: false });
    return NextResponse.json({
      opinion: row.opinion, targetPrice: row.targetPrice,
      risk: row.risk, summary: row.summary,
      sections: row.sections, sources: row.sources,
      analyzedAt: row.analyzedAt.toISOString(),
      stale: Date.now() - row.analyzedAt.getTime() > ANALYSIS_TTL_MS,
      cached: true,
    });
  } catch { return NextResponse.json({ cached: false }); }
}

// ── POST: 분석 실행 ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, ticker, force = false } = await req.json();
  if (!name || !ticker) return NextResponse.json({ error: "name and ticker required" }, { status: 400 });

  // 캐시 유효 시 즉시 반환
  if (!force) {
    try {
      const existing = await prisma.stockAiAnalysis.findUnique({ where: { ticker } });
      if (existing && Date.now() - existing.analyzedAt.getTime() < ANALYSIS_TTL_MS) {
        return NextResponse.json({
          opinion: existing.opinion, targetPrice: existing.targetPrice,
          risk: existing.risk, summary: existing.summary,
          sections: existing.sections, sources: existing.sources,
          analyzedAt: existing.analyzedAt.toISOString(), cached: true,
        });
      }
    } catch { /* continue */ }
  }

  try {
    // Step 1: DB에서 기술적 지표 로드 (API 호출 없음)
    const chartCache = await prisma.stockChartCache.findFirst({
      where: { ticker, interval: "1d" },
      orderBy: { fetchedAt: "desc" },
    });

    const meta = chartCache?.meta as Record<string, unknown> | null;
    const technicals = (meta?.technicals as Technicals | undefined) ?? {};
    const bars = chartCache?.bars as Array<{ close: number }> | null;
    const lastClose = bars?.at(-1)?.close;

    // Step 2: 룰 기반 신호 계산 (즉시, Groq 불필요)
    const signal = computeRuleSignal(technicals, lastClose);

    // Step 3: 뉴스 헤드라인 (3초 타임아웃)
    const headlines = await fetchHeadlines(name);

    // Step 4: Groq 소형 모델로 뉴스 + 기술적 신호 종합
    const rawText = await runMiniAnalysis(name, ticker, signal, headlines);
    const { opinion, risk, summary, sections } = parseMiniResponse(rawText, signal);

    const row = await prisma.stockAiAnalysis.upsert({
      where: { ticker },
      create: {
        ticker, name, opinion, targetPrice: null, risk, summary,
        sections: sections as never, sources: headlines.slice(0, 3),
      },
      update: {
        name, opinion, targetPrice: null, risk, summary,
        sections: sections as never, sources: headlines.slice(0, 3),
        analyzedAt: new Date(),
      },
    });

    return NextResponse.json({
      opinion: row.opinion, targetPrice: null,
      risk: row.risk, summary: row.summary,
      sections, sources: headlines.slice(0, 3),
      analyzedAt: row.analyzedAt.toISOString(),
      cached: false,
      techSignal: signal, // 디버그용
    });
  } catch (e) {
    console.error("[ai-analysis POST]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
