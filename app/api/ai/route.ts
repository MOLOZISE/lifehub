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
          maxResults: 6,
          includeAnswer: false,
        });
        if (result.results?.length) {
          const articles = result.results
            .map((r, i) => `[${i + 1}] ${r.title}\n출처: ${r.url}\n${r.content?.slice(0, 500)}`)
            .join("\n\n");
          contextBlock = `\n\n[실시간 검색 결과 - ${today}]\n${articles}\n\n위 최신 뉴스를 바탕으로 분석하세요.`;
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
