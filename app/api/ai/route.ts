import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
}

function getTavily() {
  return tavily({ apiKey: process.env.TAVILY_API_KEY ?? "" });
}

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage, history, useSearch } = await req.json();

    let contextBlock = "";

    // Real-time web search via Tavily
    if (useSearch && process.env.TAVILY_API_KEY) {
      try {
        const client = getTavily();
        const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
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
          contextBlock = `\n\n[실시간 검색 결과 - ${today}]\n${articles}\n\n반드시 위 최신 뉴스 내용만 바탕으로 분석하세요. 오래된 정보는 사용하지 마세요.`;
        } else {
          contextBlock = `\n\n[주의: 실시간 검색 결과 없음 - ${today}]\n오늘 날짜 기준으로 최신 정보로 분석하되, 최신이 아닐 수 있음을 명시하세요.`;
        }
      } catch (e) {
        console.warn("Tavily search failed:", e);
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
