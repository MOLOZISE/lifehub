import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";

export const maxDuration = 60; // Vercel Pro: 60s, Hobby: 10s

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
}

function extractTicker(message: string): string | null {
  const engMatch = message.match(/\b([A-Z]{2,5})\b/);
  if (engMatch) return engMatch[1];
  const krMatch = message.match(/\b(\d{6})\b/);
  if (krMatch) return krMatch[1];
  return null;
}

function extractKeyword(message: string): string {
  return message
    .replace(/종목의?|최신|뉴스|시장\s*동향|분석|해\s*주세요|주세요|조사하고|을|를|의|이|가/g, "")
    .replace(/Google\s*검색으로|바탕으로/g, "")
    .trim()
    .split(/\s+/)[0];
}

// ── Tavily: 전문 AI 검색 (뉴스 본문 포함) ──────────────────────────────────
async function fetchTavily(query: string): Promise<{ articles: string[]; source: string }> {
  if (!process.env.TAVILY_API_KEY) return { articles: [], source: "" };
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const result = await client.search(query, {
      searchDepth: "advanced",
      maxResults: 6,
      includeAnswer: false,
      days: 7,
    });
    if (!result.results?.length) return { articles: [], source: "" };
    const articles = result.results.map((r, i) => {
      const pub = (r as { published_date?: string }).published_date;
      return `[Tavily ${i + 1}] ${r.title}${pub ? ` (${pub})` : ""}\n출처: ${r.url}\n${r.content?.slice(0, 500) ?? ""}`;
    });
    return { articles, source: "Tavily" };
  } catch (e) {
    console.warn("Tavily failed:", e);
    return { articles: [], source: "" };
  }
}

// ── Finnhub: 주식 전문 뉴스 (US 종목 최적) ────────────────────────────────
async function fetchFinnhub(ticker: string): Promise<{ articles: string[]; source: string }> {
  if (!process.env.FINNHUB_API_KEY || !ticker) return { articles: [], source: "" };
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`,
      { cache: "no-store" }
    );
    if (!res.ok) return { articles: [], source: "" };
    const items = await res.json() as { headline: string; summary: string; url: string; datetime: number }[];
    if (!Array.isArray(items) || items.length === 0) return { articles: [], source: "" };
    const articles = items.slice(0, 6).map((n, i) => {
      const date = new Date(n.datetime * 1000).toLocaleDateString("ko-KR");
      return `[Finnhub ${i + 1}] ${n.headline} (${date})\n출처: ${n.url}\n${n.summary?.slice(0, 300) ?? ""}`;
    });
    return { articles, source: "Finnhub" };
  } catch { return { articles: [], source: "" }; }
}

// ── Google News RSS: 한국어/영어 실시간 헤드라인 ──────────────────────────
async function fetchGoogleNews(query: string, lang: "ko" | "en" = "ko"): Promise<{ articles: string[]; source: string }> {
  try {
    const params = new URLSearchParams({
      q: query,
      hl: lang,
      gl: lang === "ko" ? "KR" : "US",
      ceid: lang === "ko" ? "KR:ko" : "US:en",
    });
    const res = await fetch(
      `https://news.google.com/rss/search?${params}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (!res.ok) return { articles: [], source: "" };
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6);
    if (items.length === 0) return { articles: [], source: "" };
    const articles = items.map((m, i) => {
      const title = m[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
        ?? m[1].match(/<title>(.*?)<\/title>/)?.[1] ?? "";
      const link = m[1].match(/<link>(.*?)<\/link>/)?.[1] ?? "";
      const pubDate = m[1].match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
      const source = m[1].match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? "";
      const dateStr = pubDate ? new Date(pubDate).toLocaleDateString("ko-KR") : "";
      return `[Google ${lang === "ko" ? "KR" : "EN"} ${i + 1}] ${title}${dateStr ? ` (${dateStr})` : ""}${source ? ` · ${source}` : ""}\n출처: ${link}`;
    });
    return { articles, source: `Google News (${lang === "ko" ? "한국어" : "영어"})` };
  } catch { return { articles: [], source: "" }; }
}

// ── Yahoo Finance 뉴스 ────────────────────────────────────────────────────
async function fetchYahooNews(ticker: string): Promise<{ articles: string[]; source: string }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=6&quotesCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (!res.ok) return { articles: [], source: "" };
    const data = await res.json() as { news?: { title: string; link: string; providerPublishTime?: number; publisher?: string }[] };
    const news = data.news ?? [];
    if (news.length === 0) return { articles: [], source: "" };
    const articles = news.map((n, i) => {
      const date = n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toLocaleDateString("ko-KR")
        : "";
      return `[Yahoo ${i + 1}] ${n.title}${date ? ` (${date})` : ""}${n.publisher ? ` · ${n.publisher}` : ""}\n출처: ${n.link}`;
    });
    return { articles, source: "Yahoo Finance" };
  } catch { return { articles: [], source: "" }; }
}

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage, history, useSearch } = await req.json();

    let contextBlock = "";
    const usedSources: string[] = [];
    const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

    if (useSearch) {
      const ticker = extractTicker(userMessage);
      const keyword = extractKeyword(userMessage);
      const isKorean = /[가-힣]/.test(keyword);

      // 모든 소스를 병렬 호출
      const [tavilyRes, finnhubRes, googleKrRes, googleEnRes, yahooRes] = await Promise.all([
        fetchTavily(userMessage),
        ticker ? fetchFinnhub(ticker) : Promise.resolve({ articles: [], source: "" }),
        fetchGoogleNews(keyword, "ko"),
        ticker && !isKorean ? fetchGoogleNews(ticker, "en") : Promise.resolve({ articles: [], source: "" }),
        ticker ? fetchYahooNews(ticker) : fetchYahooNews(keyword),
      ]);

      // 수집된 뉴스 합치기 (각 소스에서 중복 제거)
      const allArticles: string[] = [];

      if (tavilyRes.articles.length) { allArticles.push(...tavilyRes.articles); usedSources.push(tavilyRes.source); }
      if (finnhubRes.articles.length) { allArticles.push(...finnhubRes.articles); usedSources.push(finnhubRes.source); }
      if (googleKrRes.articles.length) { allArticles.push(...googleKrRes.articles); usedSources.push(googleKrRes.source); }
      if (googleEnRes.articles.length) { allArticles.push(...googleEnRes.articles); usedSources.push(googleEnRes.source); }
      if (yahooRes.articles.length) { allArticles.push(...yahooRes.articles); usedSources.push(yahooRes.source); }

      if (allArticles.length > 0) {
        contextBlock = `\n\n[실시간 뉴스 - ${today}] (출처: ${usedSources.join(", ")})\n\n`
          + allArticles.join("\n\n")
          + `\n\n위 최신 뉴스들을 종합해서 분석하세요. 뉴스에 없는 내용은 추측하지 말고, 날짜가 오래된 정보는 제외하세요.`;
      } else {
        contextBlock = `\n\n[⚠️ 실시간 뉴스 없음 - ${today}]\n실시간 데이터를 가져오지 못했습니다. 훈련 데이터 기반 분석임을 명시하고 "최신 정보 직접 확인 필요"를 언급하세요.`;
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
    return NextResponse.json({ text, sources: usedSources });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
