"use client";

import { useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SYSTEM_PROMPT = `당신은 15년 경력의 주식 투자 전략가입니다. 사용자의 보유 현황과 투자 성향을 바탕으로
1) 현재 상황 진단
2) 3가지 시나리오별 전략 (낙관/중립/비관)
3) 구체적 대응 방안
을 제시하세요. 반드시 손절가와 목표가를 숫자로 명시하세요.

각 시나리오는 다음 형식으로 작성하세요:
### 🟢 낙관 시나리오
내용...
손절가: XXX원 | 목표가: XXX원

### 🟡 중립 시나리오
내용...
손절가: XXX원 | 목표가: XXX원

### 🔴 비관 시나리오
내용...
손절가: XXX원 | 목표가: XXX원`;

interface ScenarioCard {
  emoji: string;
  title: string;
  content: string;
  color: string;
  borderColor: string;
  bgColor: string;
}

function parseScenarios(text: string): { diagnosis: string; scenarios: ScenarioCard[]; actionPlan: string } {
  const diagnosisMatch = text.match(/현재 상황 진단[:\s]*([\s\S]*?)(?=###|$)/i);
  const diagnosis = diagnosisMatch?.[1]?.trim() ?? "";

  const scenarios: ScenarioCard[] = [
    { emoji: "🟢", title: "낙관 시나리오", color: "text-green-600 dark:text-green-400", borderColor: "border-green-300 dark:border-green-800", bgColor: "bg-green-50 dark:bg-green-950/50", content: "" },
    { emoji: "🟡", title: "중립 시나리오", color: "text-yellow-600 dark:text-yellow-400", borderColor: "border-yellow-300 dark:border-yellow-800", bgColor: "bg-yellow-50 dark:bg-yellow-950/50", content: "" },
    { emoji: "🔴", title: "비관 시나리오", color: "text-red-600 dark:text-red-400", borderColor: "border-red-300 dark:border-red-800", bgColor: "bg-red-50 dark:bg-red-950/50", content: "" },
  ];

  scenarios.forEach(s => {
    const regex = new RegExp(`###.*${s.title}[\\s\\S]*?([\\s\\S]*?)(?=###|$)`, "i");
    const match = text.match(regex);
    if (match) s.content = match[1].trim();
  });

  const actionPlanMatch = text.match(/구체적 대응 방안[:\s]*([\s\S]*?)(?=###|$)/i);
  const actionPlan = actionPlanMatch?.[1]?.trim() ?? "";

  return { diagnosis, scenarios, actionPlan };
}

export default function StrategyPage() {
  const [form, setForm] = useState({ ticker: "", quantity: "", avgPrice: "", goal: "long", risk: "neutral" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof parseScenarios> | null>(null);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit() {
    setLoading(true); setError(""); setResult(null);
    const userMsg = `종목: ${form.ticker}, 보유수량: ${form.quantity}주, 평균매입가: ${form.avgPrice}원, 투자목표: ${{"short":"단타","swing":"스윙","long":"장기"}[form.goal]}, 리스크성향: ${{"aggressive":"공격적","neutral":"중립","conservative":"보수적"}[form.risk]}`;
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: SYSTEM_PROMPT, userMessage: userMsg }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setRawText(data.text);
      setResult(parseScenarios(data.text));
    } catch { setError("API 호출 실패"); } finally { setLoading(false); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">AI 투자 전략 어드바이저</h2>
        <p className="text-sm text-muted-foreground">보유 현황을 입력하면 AI가 3가지 시나리오별 전략을 제시합니다</p>
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><p className="text-xs mb-1">종목명/티커</p><Input placeholder="예: 삼성전자" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} /></div>
            <div><p className="text-xs mb-1">보유 수량</p><Input type="number" placeholder="주" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            <div><p className="text-xs mb-1">평균 매입가</p><Input type="number" placeholder="원" value={form.avgPrice} onChange={e => setForm(f => ({ ...f, avgPrice: e.target.value }))} /></div>
            <div><p className="text-xs mb-1">투자 목표</p>
              <Select value={form.goal} onValueChange={v => v && setForm(f => ({ ...f, goal: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">단타</SelectItem>
                  <SelectItem value="swing">스윙</SelectItem>
                  <SelectItem value="long">장기</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1"><p className="text-xs mb-1">리스크 성향</p>
              <Select value={form.risk} onValueChange={v => v && setForm(f => ({ ...f, risk: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aggressive">공격적</SelectItem>
                  <SelectItem value="neutral">중립</SelectItem>
                  <SelectItem value="conservative">보수적</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="mt-4" onClick={handleSubmit} disabled={loading || !form.ticker}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
              전략 분석
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-3" />AI가 투자 전략을 분석 중...
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.diagnosis && (
            <Card><CardContent className="p-4"><p className="text-sm font-medium mb-1">📋 현재 상황 진단</p><p className="text-sm text-muted-foreground whitespace-pre-line">{result.diagnosis}</p></CardContent></Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.scenarios.map((s, i) => (
              <Card key={i} className={`border ${s.borderColor}`}>
                <CardHeader className={`pb-2 pt-3 px-4 ${s.bgColor} rounded-t-lg`}>
                  <CardTitle className={`text-sm ${s.color}`}>{s.emoji} {s.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{s.content || "분석 중..."}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {result.actionPlan && (
            <Card><CardContent className="p-4"><p className="text-sm font-medium mb-1">🎯 구체적 대응 방안</p><p className="text-sm text-muted-foreground whitespace-pre-line">{result.actionPlan}</p></CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
