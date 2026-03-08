"use client";

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getHoldings, getWatchlist } from "@/lib/storage";
import type { Holding, WatchlistItem } from "@/lib/types";

const KRW_TO_USD = 1350;

function toUSD(h: Holding): number {
  const v = h.quantity * h.currentPrice;
  return h.currency === "KRW" ? v / KRW_TO_USD : v;
}

function buildPortfolioContext(holdings: Holding[], watchlist: WatchlistItem[], riskPref: string, goal: string): string {
  const totalUSD = holdings.reduce((s, h) => s + toUSD(h), 0);

  const holdingLines = holdings.map(h => {
    const rate = ((h.currentPrice - h.avgPrice) / h.avgPrice * 100).toFixed(1);
    const weight = totalUSD > 0 ? (toUSD(h) / totalUSD * 100).toFixed(1) : "0";
    const profitSign = parseFloat(rate) >= 0 ? "+" : "";
    return `- ${h.name}(${h.ticker}): ${h.quantity}주, 평균단가 ${h.avgPrice.toLocaleString()}${h.currency === "KRW" ? "원" : "$"}, 현재가 ${h.currentPrice.toLocaleString()}${h.currency === "KRW" ? "원" : "$"}, 수익률 ${profitSign}${rate}%, 포트폴리오 비중 ${weight}%`;
  }).join("\n");

  const watchlistLines = watchlist.length > 0
    ? watchlist.map(w => `- ${w.name}(${w.ticker}): 현재가 ${w.currentPrice}${w.currency === "KRW" ? "원" : "$"}${w.targetPrice ? `, 목표가 ${w.targetPrice}` : ""}${w.memo ? `, 메모: ${w.memo}` : ""}`).join("\n")
    : "없음";

  return `
=== 보유 포트폴리오 ===
총 평가금액(USD 환산): $${totalUSD.toFixed(0)}
보유 종목 수: ${holdings.length}개
투자 목표: ${{"short":"단타","swing":"스윙","long":"장기투자"}[goal] ?? goal}
리스크 성향: ${{"aggressive":"공격적","neutral":"중립","conservative":"보수적"}[riskPref] ?? riskPref}

보유 종목:
${holdingLines || "없음"}

관심 종목(위시리스트):
${watchlistLines}
`.trim();
}

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
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [goal, setGoal] = useState("long");
  const [risk, setRisk] = useState("neutral");
  const [focusTicker, setFocusTicker] = useState("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof parseScenarios> | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setHoldings(getHoldings());
    setWatchlist(getWatchlist());
  }, []);

  const SYSTEM_PROMPT = `당신은 15년 경력의 주식 투자 전략가입니다. 사용자의 전체 포트폴리오 현황을 Google 검색으로 현재 시장 상황을 파악한 뒤,
1) 현재 상황 진단 (포트폴리오 전체 관점)
2) 3가지 시나리오별 전략 (낙관/중립/비관)
3) 구체적 대응 방안 (종목별 액션 포함)
을 제시하세요.

각 시나리오는 반드시 다음 형식:
### 🟢 낙관 시나리오
내용...
손절가: XXX | 목표가: XXX

### 🟡 중립 시나리오
내용...

### 🔴 비관 시나리오
내용...

실제 최신 시장 데이터를 검색하여 현실적인 분석을 제공하세요. 특정 종목에 집중 분석 요청이 있으면 해당 종목 위주로 상세히 분석하세요.`;

  async function handleSubmit() {
    if (holdings.length === 0) return;
    setLoading(true); setError(""); setResult(null); setAnalyzedAt(null);

    const portfolioContext = buildPortfolioContext(holdings, watchlist, risk, goal);
    const focusNote = focusTicker !== "all"
      ? `\n\n특별히 ${focusTicker} 종목에 대해 집중 분석해주세요.`
      : "";

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPT,
          userMessage: portfolioContext + focusNote + "\n\n최신 시장 동향을 검색하여 위 포트폴리오에 대한 투자 전략을 분석해주세요.",
          useSearch: true,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(parseScenarios(data.text));
      setAnalyzedAt(new Date().toLocaleString("ko-KR"));
    } catch { setError("API 호출 실패"); } finally { setLoading(false); }
  }

  const totalUSD = holdings.reduce((s, h) => s + toUSD(h), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">AI 투자 전략 어드바이저</h2>
        <p className="text-sm text-muted-foreground">보유 포트폴리오 + Google 검색 기반 실시간 시나리오 분석</p>
      </div>

      {/* Portfolio summary */}
      {holdings.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">분석 대상 포트폴리오</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {holdings.map(h => {
                const rate = ((h.currentPrice - h.avgPrice) / h.avgPrice * 100);
                const weight = totalUSD > 0 ? (toUSD(h) / totalUSD * 100) : 0;
                return (
                  <div key={h.id} className={`text-xs px-2.5 py-1.5 rounded-lg border ${rate >= 0 ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"}`}>
                    <span className="font-medium">{h.name}</span>
                    <span className="text-muted-foreground ml-1">{weight.toFixed(0)}%</span>
                    <span className={`ml-1 font-medium ${rate >= 0 ? "text-red-600" : "text-blue-600"}`}>{rate >= 0 ? "+" : ""}{rate.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <p className="text-xs mb-1 text-muted-foreground">분석 종목</p>
                <Select value={focusTicker} onValueChange={v => v && setFocusTicker(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 포트폴리오</SelectItem>
                    {holdings.map(h => <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>)}
                    {watchlist.map(w => <SelectItem key={w.id} value={w.name}>👁 {w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs mb-1 text-muted-foreground">투자 목표</p>
                <Select value={goal} onValueChange={v => v && setGoal(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">단타</SelectItem>
                    <SelectItem value="swing">스윙</SelectItem>
                    <SelectItem value="long">장기</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs mb-1 text-muted-foreground">리스크 성향</p>
                <Select value={risk} onValueChange={v => v && setRisk(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aggressive">공격적</SelectItem>
                    <SelectItem value="neutral">중립</SelectItem>
                    <SelectItem value="conservative">보수적</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full h-8 text-xs" onClick={handleSubmit} disabled={loading || holdings.length === 0}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5 mr-1" />}
                  전략 분석
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm">포트폴리오 페이지에서 보유 종목을 먼저 등록해주세요</p>
          </CardContent>
        </Card>
      )}

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {loading && (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
          <Loader2 className="w-7 h-7 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium">최신 시장 데이터 검색 및 포트폴리오 분석 중...</p>
            <p className="text-xs mt-1 opacity-60">실시간 검색이 포함되어 15~30초 소요될 수 있습니다</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-sm">📋 전략 분석 결과</span>
              {analyzedAt && <span className="text-xs text-muted-foreground ml-2">{analyzedAt}</span>}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleSubmit} disabled={loading}>
              <RefreshCw className="w-3 h-3" />재분석
            </Button>
          </div>
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
          <p className="text-xs text-muted-foreground">⚠️ AI 분석은 참고용입니다. 투자 결정은 본인 책임입니다.</p>
        </div>
      )}
    </div>
  );
}
