import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
}

// 티커 추출 (종목명 → 영문 티커 추정)
function extractTicker(message: string): string | null {
  // 영문 대문자 티커 패턴 (AAPL, TSLA 등)
  const engMatch = message.match(/\b([A-Z]{2,5})\b/);
  if (engMatch) return engMatch[1];
  // 한국 종목코드 (6자리 숫자)
  const krMatch = message.match(/\b(\d{6})\b/);
  if (krMatch) return krMatch[1];
  return null;
}

// Finnhub 뉴스 (무료, API 키 필요)
async function fetchFinnhubNews(ticker: string): Promise<string> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return "";
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${key}`,
      { cache: "no-store" }
    );
    if (!res.ok) return "";
    const items = await res.json() as { headline: string; summary: string; url: string; datetime: number }[];
    if (!Array.isArray(items) || items.length === 0) return "";
    return items.slice(0, 8).map((n, i) => {
      const date = new Date(n.datetime * 1000).toLocaleDateString("ko-KR");
      return `[${i + 1}] ${n.headline} (${date})\n출처: ${n.url}\n${n.summary?.slice(0, 400) ?? ""}`;
    }).join("\n\n");
  } catch { return ""; }
}

// Yahoo Finance 비공식 뉴스 (API 키 불필요)
async function fetchYahooNews(ticker: string): Promise<string> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=8&quotesCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (!res.ok) return "";
    const data = await res.json() as { news?: { title: string; link: string; providerPublishTime?: number; publisher?: string }[] };
    const news = data.news ?? [];
    if (news.length === 0) return "";
    const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    return `[Yahoo Finance 뉴스 - ${today}]\n` + news.slice(0, 8).map((n, i) => {
      const date = n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toLocaleDateString("ko-KR")
        : "";
      return `[${i + 1}] ${n.title}${date ? ` (${date})` : ""}\n출처: ${n.link}`;
    }).join("\n\n");
  } catch { return ""; }
}

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage, history, useSearch } = await req.json();

    let contextBlock = "";
    const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

    if (useSearch) {
      // 1순위: Tavily (설정된 경우)
      if (process.env.TAVILY_API_KEY) {
        try {
          const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
          const result = await client.search(userMessage, {
            searchDepth: "advanced",
            maxResults: 8,
            includeAnswer: false,
            days: 7,
          });
          if (result.results?.length) {
            const articles = result.results
              .map((r, i) => {
                const pub = (r as { published_date?: string }).published_date;
                return `[${i + 1}] ${r.title}${pub ? ` (${pub})` : ""}\n출처: ${r.url}\n${r.content?.slice(0, 600)}`;
              })
              .join("\n\n");
            contextBlock = `\n\n[Tavily 실시간 검색 - ${today}]\n${articles}\n\n반드시 위 최신 뉴스 내용만 바탕으로 분석하세요.`;
          }
        } catch (e) {
          console.warn("Tavily failed:", e);
        }
      }

      // 2순위: Finnhub 뉴스 (FINNHUB_API_KEY 있을 때)
      if (!contextBlock) {
        const ticker = extractTicker(userMessage);
        if (ticker) {
          const finnhubNews = await fetchFinnhubNews(ticker);
          if (finnhubNews) {
            contextBlock = `\n\n[Finnhub 실시간 뉴스 - ${today}]\n${finnhubNews}\n\n위 최신 뉴스를 바탕으로 분석하세요.`;
          }
        }
      }

      // 3순위: Yahoo Finance 뉴스 (API 키 불필요)
      if (!contextBlock) {
        const ticker = extractTicker(userMessage);
        const searchTarget = ticker ?? userMessage.split(" ")[0];
        const yahooNews = await fetchYahooNews(searchTarget);
        if (yahooNews) {
          contextBlock = `\n\n[${yahooNews}]\n\n위 최신 뉴스를 바탕으로 분석하세요. 기사가 없는 내용은 추측하지 마세요.`;
        }
      }

      // 모두 실패 시 명시적 경고
      if (!contextBlock) {
        contextBlock = `\n\n[⚠️ 실시간 뉴스 데이터 없음 - ${today}]\n실시간 뉴스를 가져오지 못했습니다. 훈련 데이터 기반으로만 답변하며, 정보가 최신이 아닐 수 있습니다. 날짜를 명시하고 "최신 정보 확인 필요"라고 반드시 언급하세요.`;
      }
    }

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      ...(history ?? []).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" as const : "user" as const,
        content: m.content,
      })),
      { role: "user" as const, content: userMessage + contextBlock },
    ];

    const completion = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
