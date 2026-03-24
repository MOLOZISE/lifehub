import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { GoogleGenAI } from "@google/genai";
import { getGeminiKeys, geminiGenerate, geminiGenerateJson, hasGeminiKey } from "@/lib/gemini";

export const maxDuration = 30;

// 무료 플랜에서 시도할 후보 모델 목록 (우선순위 순)
const PROBE_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-1.0-pro",
  "gemini-pro",
];

// 관리자 체크
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") return null;
  return session;
}

// GET: API 키 상태 조회
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const keys = getGeminiKeys();
  return NextResponse.json({
    configured: keys.length,
    slots: [1, 2, 3].map(i => ({
      slot: i,
      set: !!process.env[`GEMINI_API_KEY_${i}`],
      preview: process.env[`GEMINI_API_KEY_${i}`]
        ? `...${process.env[`GEMINI_API_KEY_${i}`]!.slice(-6)}`
        : null,
    })),
  });
}

// POST: 기능별 테스트 실행
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  if (!hasGeminiKey()) {
    return NextResponse.json({ error: "GEMINI_API_KEY_1 이 설정되지 않았습니다." }, { status: 400 });
  }

  const { type, model: overrideModel } = await req.json() as { type: string; model?: string };
  const t0 = Date.now();

  try {
    if (type === "probe") {
      // ── 사용 가능한 모델 자동 탐지 ────────────────────────────────────────
      const key = getGeminiKeys()[0];
      const ai = new GoogleGenAI({ apiKey: key });
      const results = await Promise.all(
        PROBE_MODELS.map(async (modelName) => {
          const t1 = Date.now();
          try {
            const r = await ai.models.generateContent({
              model: modelName,
              contents: "OK",
              config: { maxOutputTokens: 20 },
            });
            return { model: modelName, ok: true, latencyMs: Date.now() - t1, text: (r.text ?? "").slice(0, 40) };
          } catch (e) {
            const msg = String(e);
            const code = msg.includes("404") ? "404" : msg.includes("429") ? "429" : msg.includes("403") ? "403" : "ERR";
            return { model: modelName, ok: false, latencyMs: Date.now() - t1, code, error: msg.slice(0, 120) };
          }
        })
      );
      const working = results.filter(r => r.ok).map(r => r.model);
      return NextResponse.json({ ok: true, type, results, working, totalMs: Date.now() - t0 });

    } else {
      // ── 기능 테스트 ──────────────────────────────────────────────────────
      const modelName = overrideModel ?? "gemini-2.0-flash";

      if (type === "basic") {
        const result = await geminiGenerate(
          "안녕하세요! 한국어로 LifeHub 앱을 소개하는 한 문장을 작성해주세요.",
          { model: modelName, temperature: 0.5, maxOutputTokens: 200 }
        );
        return NextResponse.json({ ok: true, type, result, latencyMs: Date.now() - t0, model: modelName });

      } else if (type === "fortune") {
        const prompt = `오늘의 간단한 운세를 JSON으로 생성해주세요.
형식: {"overall":"전체 운세 1문장","score":85,"luckyColor":"행운 색상","luckyNumber":7,"advice":"오늘의 한마디"}`;
        const result = await geminiGenerateJson<unknown>(prompt, { model: modelName, temperature: 0.85, maxOutputTokens: 512 });
        return NextResponse.json({ ok: true, type, result, latencyMs: Date.now() - t0, model: modelName });

      } else if (type === "study") {
        const result = await geminiGenerate(
          "학습 코치로서, 하루 2시간씩 30일 공부한 학생에게 짧은 동기부여 메시지와 개선 팁 2가지를 한국어로 제공해주세요.",
          { model: modelName, temperature: 0.6, maxOutputTokens: 400 }
        );
        return NextResponse.json({ ok: true, type, result, latencyMs: Date.now() - t0, model: modelName });

      } else if (type === "multikey") {
        const keys = getGeminiKeys();
        const results = await Promise.all(
          keys.map(async (key, idx) => {
            const t1 = Date.now();
            try {
              const ai = new GoogleGenAI({ apiKey: key });
              const r = await ai.models.generateContent({
                model: modelName,
                contents: `키 ${idx + 1} 테스트: "OK" 라고만 답해주세요.`,
                config: { temperature: 0.3, maxOutputTokens: 50 },
              });
              return { slot: idx + 1, ok: true, latencyMs: Date.now() - t1, text: (r.text ?? "").trim() };
            } catch (e) {
              return { slot: idx + 1, ok: false, latencyMs: Date.now() - t1, error: String(e).slice(0, 100) };
            }
          })
        );
        return NextResponse.json({ ok: true, type, results, totalMs: Date.now() - t0, model: modelName });

      } else {
        return NextResponse.json({ error: `알 수 없는 테스트 타입: ${type}` }, { status: 400 });
      }
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), latencyMs: Date.now() - t0 }, { status: 500 });
  }
}
