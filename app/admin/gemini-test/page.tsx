"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Zap, Sparkles, BookOpen, Key, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface KeySlot { slot: number; set: boolean; preview: string | null; }
interface KeyStatus { configured: number; slots: KeySlot[]; }

interface TestResult {
  ok: boolean;
  type: string;
  result?: unknown;
  raw?: string;
  results?: { slot: number; ok: boolean; latencyMs: number; text?: string; error?: string }[];
  error?: string;
  latencyMs?: number;
  totalMs?: number;
  model?: string;
}

const TESTS = [
  {
    type: "basic",
    icon: <Zap className="w-4 h-4 text-yellow-500" />,
    label: "기본 텍스트 생성",
    desc: "gemini-2.0-flash 기본 응답 테스트",
  },
  {
    type: "fortune",
    icon: <Sparkles className="w-4 h-4 text-purple-500" />,
    label: "운세 JSON 구조화",
    desc: "responseMimeType: application/json 테스트",
  },
  {
    type: "study",
    icon: <BookOpen className="w-4 h-4 text-blue-500" />,
    label: "학습 조언 생성",
    desc: "학습 코치 프롬프트 테스트",
  },
  {
    type: "multikey",
    icon: <Key className="w-4 h-4 text-emerald-500" />,
    label: "다중 키 순환 테스트",
    desc: "등록된 모든 키를 순서대로 테스트",
  },
];

export default function GeminiTestPage() {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/gemini-test");
      if (res.ok) setKeyStatus(await res.json());
      else setKeyStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function runTest(type: string) {
    setRunning(type);
    try {
      const res = await fetch("/api/admin/gemini-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      setResults(prev => ({ ...prev, [type]: data }));
    } catch (e) {
      setResults(prev => ({ ...prev, [type]: { ok: false, type, error: String(e) } }));
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    for (const t of TESTS) {
      await runTest(t.type);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-amber-500" />
        <h1 className="text-xl font-bold">Gemini API 테스트</h1>
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-0 text-[10px]">
          관리자 전용
        </Badge>
      </div>

      {/* 환경 변수 등록 안내 */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Vercel 환경 변수 등록 방법</p>
          <p className="text-xs text-muted-foreground">Vercel Dashboard → Project → Settings → Environment Variables</p>
          <div className="space-y-1 font-mono text-xs">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2 bg-background rounded px-2 py-1">
                <code className="text-primary">GEMINI_API_KEY_{i}</code>
                <span className="text-muted-foreground">= AIza...</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">하나만 사용할 경우 GEMINI_API_KEY_1 만 등록. 3개 모두 등록 시 자동 라운드로빈.</p>
        </CardContent>
      </Card>

      {/* API 키 상태 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">API 키 상태</CardTitle>
            <button onClick={loadStatus} disabled={loadingStatus} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? "animate-spin" : ""}`} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />확인 중...
            </div>
          ) : keyStatus ? (
            <div className="space-y-2">
              <p className="text-sm">
                총 <span className="font-bold text-primary">{keyStatus.configured}개</span> 키 등록됨
              </p>
              <div className="grid grid-cols-3 gap-2">
                {keyStatus.slots.map(slot => (
                  <div key={slot.slot} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${slot.set ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-dashed border-muted-foreground/30"}`}>
                    {slot.set
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    }
                    <div>
                      <p className="font-medium">키 {slot.slot}</p>
                      <p className="text-[10px] text-muted-foreground">{slot.preview ?? "미등록"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">키 상태 조회 실패 (관리자 계정 확인)</p>
          )}
        </CardContent>
      </Card>

      {/* 테스트 버튼 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">기능 테스트</p>
        <Button size="sm" variant="outline" onClick={runAll} disabled={!!running} className="h-7 text-xs gap-1">
          <Zap className="w-3 h-3" />전체 실행
        </Button>
      </div>

      <div className="space-y-3">
        {TESTS.map(test => {
          const result = results[test.type];
          const isRunning = running === test.type;

          return (
            <Card key={test.type} className={result ? (result.ok ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800") : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {test.icon}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{test.label}</p>
                      <p className="text-xs text-muted-foreground">{test.desc}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={result?.ok ? "outline" : "default"}
                    onClick={() => runTest(test.type)}
                    disabled={!!running}
                    className="h-7 text-xs shrink-0"
                  >
                    {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : "실행"}
                  </Button>
                </div>

                {/* 결과 표시 */}
                {result && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      {result.ok
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        : <XCircle className="w-3.5 h-3.5 text-red-500" />
                      }
                      <span className={result.ok ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                        {result.ok ? "성공" : "실패"}
                      </span>
                      {result.latencyMs && (
                        <span className="text-muted-foreground">{result.latencyMs}ms</span>
                      )}
                      {result.totalMs && (
                        <span className="text-muted-foreground">총 {result.totalMs}ms</span>
                      )}
                      {result.model && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">{result.model}</Badge>
                      )}
                    </div>

                    {/* 에러 */}
                    {result.error && (
                      <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1.5 break-all">
                        {result.error}
                      </p>
                    )}

                    {/* 다중 키 결과 */}
                    {result.results && (
                      <div className="space-y-1">
                        {result.results.map(r => (
                          <div key={r.slot} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${r.ok ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                            {r.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                            <span className="font-medium">키 {r.slot}</span>
                            <span className="text-muted-foreground">{r.latencyMs}ms</span>
                            {r.text && <span className="text-foreground">{r.text}</span>}
                            {r.error && <span className="text-red-500 break-all">{r.error.slice(0, 80)}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 일반 텍스트 결과 */}
                    {result.ok && typeof result.result === "string" && (
                      <div className="text-xs bg-muted/60 rounded p-2.5 leading-relaxed whitespace-pre-wrap">
                        {result.result}
                      </div>
                    )}

                    {/* JSON 결과 */}
                    {result.ok && typeof result.result === "object" && result.result !== null && !Array.isArray(result.result) && (
                      <div className="text-xs bg-muted/60 rounded p-2.5 space-y-1">
                        {Object.entries(result.result as Record<string, unknown>).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">{k}:</span>
                            <span className="font-medium break-all">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
