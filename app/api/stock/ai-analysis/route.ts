import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";

const ANALYSIS_TTL_MS = 60 * 60 * 1000; // 1시간

const SYSTEM_PROMPT = `당신은 CFA 자격증을 보유한 주식 전문 애널리스트입니다. 최신 뉴스와 시장 데이터를 조사하고 분석하세요.

반드시 다음 형식으로 응답하세요:

## 호재 요인
- 항목 (출처/날짜)

## 악재 요인
- 항목 (출처/날짜)

## 중립/주목 요인
- 항목

## 단기 전망 (1~4주)
내용. 주요 이벤트 포함.

## 중장기 전망 (3~12개월)
내용. 섹터 트렌드, 펀더멘털 포함.

## 종합 투자의견
- 투자의견: [강력매수 / 매수 / 중립 / 매도 / 강력매도]
- 목표주가: [가격 또는 "정보 없음"]
- 리스크: [상/중/하]
- 한 줄 요약: [핵심 판단]

추정 정보는 "추정:" 접두어를 붙이세요.`;

type SectionType = "positive" | "negative" | "neutral" | "short" | "long" | "summary";
interface NewsSection { type: SectionType; title: string; items: string[]; text?: string; }

function parseNewsResponse(text: string): NewsSection[] {
  const sectionMap: Record<string, SectionType> = {
    "호재": "positive", "악재": "negative", "중립": "neutral",
    "단기 전망": "short", "중장기 전망": "long", "종합 투자의견": "summary",
  };
  const parts = text.split(/^## /m).filter(Boolean);
  return parts.flatMap(part => {
    const lines = part.trim().split("\n");
    const title = lines[0].trim();
    const body = lines.slice(1).join("\n").trim();
    const items = lines.slice(1).filter(l => l.trim().startsWith("-")).map(l => l.replace(/^-\s*/, "").trim());
    const typeKey = Object.keys(sectionMap).find(k => title.includes(k));
    return typeKey ? [{ type: sectionMap[typeKey], title, items, text: body }] : [];
  });
}

function parseSummary(sections: NewsSection[]) {
  const s = sections.find(s => s.type === "summary");
  if (!s) return { opinion: null, targetPrice: null, risk: null, summary: null };
  const find = (key: string) => {
    const line = s.items.find(i => i.startsWith(key)) ?? s.text?.split("\n").find(l => l.includes(key)) ?? "";
    return line.replace(/^.*?:\s*/, "").trim() || null;
  };
  return { opinion: find("투자의견"), targetPrice: find("목표주가"), risk: find("리스크"), summary: find("한 줄 요약") };
}

async function fetchTavily(query: string): Promise<{ articles: string[]; sources: string[] }> {
  if (!process.env.TAVILY_API_KEY) return { articles: [], sources: [] };
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const result = await client.search(query, { searchDepth: "advanced", maxResults: 5, includeAnswer: false, days: 7 });
    if (!result.results?.length) return { articles: [], sources: [] };
    const articles = result.results.map((r, i) => {
      const pub = (r as { published_date?: string }).published_date;
      return `[${i + 1}] ${r.title}${pub ? ` (${pub})` : ""}\n${r.content?.slice(0, 400) ?? ""}`;
    });
    const sources = result.results.map(r => {
      try { return new URL(r.url).hostname.replace("www.", ""); } catch { return r.url; }
    });
    return { articles, sources };
  } catch { return { articles: [], sources: [] }; }
}

async function runAnalysis(name: string, ticker: string): Promise<{
  sections: NewsSection[]; sources: string[];
  opinion: string | null; targetPrice: string | null; risk: string | null; summary: string | null;
}> {
  const { articles, sources } = await fetchTavily(`${name} 주식 최신 뉴스 투자 분석 2025`);

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
  const contextBlock = articles.length > 0
    ? `\n\n[최신 뉴스/분석 자료]\n${articles.join("\n\n")}`
    : "";

  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${name}(${ticker}) 종목의 최신 뉴스, 시장 동향, 재무 지표를 분석해주세요. 가능하면 최근 애널리스트 목표주가 및 투자의견도 포함하세요.${contextBlock}`,
      },
    ],
    max_tokens: 2000,
  });

  const text = chat.choices[0]?.message?.content ?? "";
  const sections = parseNewsResponse(text);
  const { opinion, targetPrice, risk, summary } = parseSummary(sections);
  return { sections, sources, opinion, targetPrice, risk, summary };
}

// ── GET: 여러 종목 캐시 일괄 조회 ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const namesParam = url.searchParams.get("names") ?? "";
  const names = namesParam.split(",").map(s => s.trim()).filter(Boolean);
  if (names.length === 0) return NextResponse.json({});

  try {
    const rows = await prisma.stockAiAnalysis.findMany({ where: { ticker: { in: names } } });
    const result: Record<string, {
      opinion: string | null; targetPrice: string | null; risk: string | null;
      summary: string | null; analyzedAt: string; stale: boolean;
    }> = {};
    for (const row of rows) {
      result[row.ticker] = {
        opinion: row.opinion,
        targetPrice: row.targetPrice,
        risk: row.risk,
        summary: row.summary,
        analyzedAt: row.analyzedAt.toISOString(),
        stale: Date.now() - row.analyzedAt.getTime() > ANALYSIS_TTL_MS,
      };
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}

// ── POST: 특정 종목 분석 (캐시 없거나 만료 시) ────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, ticker, force = false } = await req.json();
  if (!name || !ticker) return NextResponse.json({ error: "name and ticker required" }, { status: 400 });

  // 캐시 확인
  if (!force) {
    try {
      const existing = await prisma.stockAiAnalysis.findUnique({ where: { ticker } });
      if (existing && Date.now() - existing.analyzedAt.getTime() < ANALYSIS_TTL_MS) {
        return NextResponse.json({
          opinion: existing.opinion,
          targetPrice: existing.targetPrice,
          risk: existing.risk,
          summary: existing.summary,
          sections: existing.sections,
          sources: existing.sources,
          analyzedAt: existing.analyzedAt.toISOString(),
          cached: true,
        });
      }
    } catch { /* continue */ }
  }

  try {
    const { sections, sources, opinion, targetPrice, risk, summary } = await runAnalysis(name, ticker);

    const row = await prisma.stockAiAnalysis.upsert({
      where: { ticker },
      create: { ticker, name, opinion, targetPrice, risk, summary, sections: sections as never, sources },
      update: { name, opinion, targetPrice, risk, summary, sections: sections as never, sources, analyzedAt: new Date() },
    });

    return NextResponse.json({
      opinion: row.opinion,
      targetPrice: row.targetPrice,
      risk: row.risk,
      summary: row.summary,
      sections,
      sources,
      analyzedAt: row.analyzedAt.toISOString(),
      cached: false,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
