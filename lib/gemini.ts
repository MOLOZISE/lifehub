/**
 * Gemini API 유틸리티
 * - 최대 3개 프로젝트 API 키 라운드로빈 순환
 * - 환경변수: GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3
 *   (하나만 쓸 경우 GEMINI_API_KEY_1 만 등록해도 됨)
 */

import { GoogleGenAI } from "@google/genai";

// 등록된 API 키 목록
export function getGeminiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter((k): k is string => !!k && k.length > 10);
}

export function hasGeminiKey(): boolean {
  return getGeminiKeys().length > 0;
}

// 서버 재시작 후 리셋되는 라운드로빈 카운터
let _rrIndex = 0;

/** 라운드로빈으로 다음 키를 반환 */
export function nextGeminiKey(): string {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error("GEMINI_API_KEY_1 환경변수가 설정되지 않았습니다.");
  const key = keys[_rrIndex % keys.length];
  _rrIndex++;
  return key;
}

/** 간단한 텍스트 생성 헬퍼 */
export async function geminiGenerate(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxOutputTokens?: number; key?: string }
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: opts?.key ?? nextGeminiKey() });
  const response = await ai.models.generateContent({
    model: opts?.model ?? "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: opts?.maxOutputTokens ?? 2048,
    },
  });
  return response.text ?? "";
}

/** JSON 구조화 응답 헬퍼 */
export async function geminiGenerateJson<T = unknown>(
  prompt: string,
  opts?: { model?: string; temperature?: number; maxOutputTokens?: number; key?: string }
): Promise<T> {
  const ai = new GoogleGenAI({ apiKey: opts?.key ?? nextGeminiKey() });
  const response = await ai.models.generateContent({
    model: opts?.model ?? "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: opts?.maxOutputTokens ?? 2048,
      responseMimeType: "application/json",
    },
  });
  return JSON.parse(response.text ?? "{}") as T;
}
