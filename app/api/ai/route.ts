import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, type ModelParams } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userMessage, history, useSearch } = await req.json();

    const modelConfig: ModelParams = {
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(useSearch ? { tools: [{ googleSearch: {} }] as any } : {}),
    };

    const model = genAI.getGenerativeModel(modelConfig);

    const geminiHistory = (history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(userMessage);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
