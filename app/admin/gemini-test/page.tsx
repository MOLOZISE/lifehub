"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck, Zap, Sparkles, BookOpen, Key,
  CheckCircle2, XCircle, Loader2, RefreshCw, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface KeySlot { slot: number; set: boolean; preview: string | null; }
interface KeyStatus { configured: number; slots: KeySlot[]; }

interface ProbeResult {
  model: string; ok: boolean; latencyMs: number;
  text?: string; code?: string; error?: string;
}

interface TestResult {
  ok: boolean; type: string;
  result?: unknown; raw?: string;
  results?: ({ slot: number; ok: boolean; latencyMs: number; text?: string; error?: string } | ProbeResult)[];
  working?: string[];
  error?: string; latencyMs?: number; totalMs?: number; model?: string;
}

const FEATURE_TESTS = [
  { type: "basic",    icon: <Zap className="w-4 h-4 text-yellow-500" />,    label: "기본 텍스트 생성",  desc: "텍스트 응답 정상 여부" },
  { type: "fortune",  icon: <Sparkles className="w-4 h-4 text-purple-500" />, label: "운세 JSON 구조화",   desc: "responseMimeType: application/json" },
  { type: "study",    icon: <BookOpen className="w-4 h-4 text-blue-500" />,   label: "학습 조언 생성",    desc: "긴 텍스트 생성 테스트" },
  { type: "multikey", icon: <Key className="w-4 h-4 text-emerald-500" />,     label: "다중 키 순환 테스트", desc: "등록된 모든 키를 순서대로 확인" },
];

export default function GeminiTestPage() {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [selectedModel, setSelectedModel] = useState<string>("gemini-1.5-flash");
  const [probeResult, setProbeResult] = useState<TestResult | null>(null);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/gemini-test");
      if (res.ok) setKeyStatus(await res.json());
      else setKeyStatus(null);
    } finally { setLoadingStatus(false); }
  }

  useEffect(() => { loadStatus(); }, []);

  async function runTest(type: string, model?: string) {
    setRunning(type);
    try {
      const res = await fetch("/api/admin/gemini-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, model: model ?? selectedModel }),
      });
      const data: TestResult = await res.json();
      if (type === "probe") {
        setProbeResult(data);
        if (data.working && data.working.length > 0) setSelectedModel(data.working[0]);
      } else {
        setResults(prev => ({ ...prev, [type]: data }));
      }
    } catch (e) {
      const err = { ok: false, type, error: String(e) };
      if (type === "probe") setProbeResult(err);
      else setResults(prev => ({ ...prev, [type]: err }));
    } finally { setRunning(null); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-amber-500" />
        <h1 className="text-xl font-bold">Gemini API 테스트</h1>
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-0 text-[10px]">관리자 전용</Badge>
      </div>

      {/* 환경변수 안내 */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Vercel 환경 변수 등록</p>
          <p className="text-xs text-muted-foreground">Settings → Environment Variables</p>
          <div className="space-y-1 font-mono text-xs">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2 bg-background rounded px-2 py-1">
                <code className="text-primary">GEMINI_API_KEY_{i}</code>
                <span className="text-muted-foreground">= AIza...</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">하나만 쓸 경우 _1만 등록. 3개 모두 등록 시 자동 라운드로빈.</p>
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />확인 중...</div>
          ) : keyStatus ? (
            <div className="space-y-2">
              <p className="text-sm">총 <span className="font-bold text-primary">{keyStatus.configured}개</span> 키 등록됨</p>
              <div className="grid grid-cols-3 gap-2">
                {keyStatus.slots.map(slot => (
                  <div key={slot.slot} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${slot.set ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" : "border-dashed border-muted-foreground/30"}`}>
                    {slot.set ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                    <div>
                      <p className="font-medium">키 {slot.slot}</p>
                      <p className="text-[10px] text-muted-foreground">{slot.preview ?? "미등록"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">조회 실패 (관리자 계정 확인)</p>
          )}
        </CardContent>
      </Card>

      {/* 모델 탐지 — 가장 먼저 실행해야 함 */}
      <Card className={probeResult ? (probeResult.ok ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800") : "border-violet-200 dark:border-violet-800"}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-violet-500" />
                <p className="text-sm font-semibold">① 사용 가능한 모델 탐지</p>
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-violet-400 text-violet-600">먼저 실행</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">9가지 후보 모델 중 실제 응답하는 모델 자동 탐지</p>
            </div>
            <Button size="sm" onClick={() => runTest("probe")} disabled={!!running} className="h-7 text-xs shrink-0 bg-violet-600 hover:bg-violet-700">
              {running === "probe" ? <Loader2 className="w-3 h-3 animate-spin" /> : "탐지"}
            </Button>
          </div>

          {probeResult && (
            <div className="space-y-2">
              {probeResult.ok && probeResult.working && (
                <div className="flex flex-wrap gap-1.5">
                  {probeResult.working.length > 0 ? (
                    <>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">사용 가능:</span>
                      {probeResult.working.map(m => (
                        <button key={m} onClick={() => setSelectedModel(m)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-mono transition-colors ${selectedModel === m ? "bg-primary text-primary-foreground border-primary" : "border-emerald-400 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"}`}>
                          {m}
                        </button>
                      ))}
                    </>
                  ) : (
                    <span className="text-xs text-red-500">사용 가능한 모델 없음 — API 키 또는 프로젝트 설정 확인 필요</span>
                  )}
                </div>
              )}
              {probeResult.ok && Array.isArray(probeResult.results) && (
                <div className="grid grid-cols-1 gap-0.5 max-h-48 overflow-y-auto">
                  {(probeResult.results as ProbeResult[]).map(r => (
                    <div key={r.model} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${r.ok ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-muted/40"}`}>
                      {r.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <XCircle className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
                      <code className={`flex-1 font-mono ${r.ok ? "text-foreground" : "text-muted-foreground"}`}>{r.model}</code>
                      <span className="text-muted-foreground">{r.latencyMs}ms</span>
                      {!r.ok && r.code && <Badge variant="outline" className="text-[9px] px-1 py-0">{r.code}</Badge>}
                    </div>
                  ))}
                </div>
              )}
              {probeResult.error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1.5 break-all">{probeResult.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 선택된 모델 표시 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">② 기능 테스트</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">모델:</span>
          <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-primary">{selectedModel}</code>
          <Button size="sm" variant="outline" onClick={async () => {
            for (const t of FEATURE_TESTS) await runTest(t.type, selectedModel);
          }} disabled={!!running} className="h-7 text-xs gap-1">
            <Zap className="w-3 h-3" />전체
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {FEATURE_TESTS.map(test => {
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
                  <Button size="sm" variant={result?.ok ? "outline" : "default"} onClick={() => runTest(test.type, selectedModel)} disabled={!!running} className="h-7 text-xs shrink-0">
                    {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : "실행"}
                  </Button>
                </div>

                {result && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      {result.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      <span className={result.ok ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                        {result.ok ? "성공" : "실패"}
                      </span>
                      {result.latencyMs && <span className="text-muted-foreground">{result.latencyMs}ms</span>}
                      {result.totalMs && <span className="text-muted-foreground">총 {result.totalMs}ms</span>}
                      {result.model && <Badge variant="secondary" className="text-[9px] px-1 py-0">{result.model}</Badge>}
                    </div>
                    {result.error && (
                      <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1.5 break-all">{result.error}</p>
                    )}
                    {result.results && (
                      <div className="space-y-1">
                        {(result.results as { slot: number; ok: boolean; latencyMs: number; text?: string; error?: string }[]).map(r => (
                          <div key={r.slot} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${r.ok ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                            {r.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                            <span className="font-medium">키 {r.slot}</span>
                            <span className="text-muted-foreground">{r.latencyMs}ms</span>
                            {r.text && <span>{r.text}</span>}
                            {r.error && <span className="text-red-500 break-all">{r.error.slice(0, 80)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.ok && typeof result.result === "string" && (
                      <div className="text-xs bg-muted/60 rounded p-2.5 leading-relaxed whitespace-pre-wrap">{result.result}</div>
                    )}
                    {result.ok && !!result.result && typeof result.result === "object" && !Array.isArray(result.result) && (
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
