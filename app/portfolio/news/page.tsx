"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, Minus, RefreshCw, Target, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SYSTEM_PROMPT = `당신은 CFA 자격증을 보유한 주식 전문 애널리스트입니다. Google 검색을 통해 최신 뉴스와 시장 데이터를 조사하고, 실제 수집한 정보를 바탕으로 분석하세요.

반드시 다음 형식으로 응답하세요 (섹션 순서 그대로):

## 호재 요인
- 항목 (출처/날짜 명시 필수)

## 악재 요인
- 항목 (출처/날짜 명시 필수)

## 중립/주목 요인
- 항목

## 단기 전망 (1~4주)
단기 전망 내용. 주요 이벤트/지표 포함.

## 중장기 전망 (3~12개월)
중장기 관점의 전망. 섹터 트렌드, 펀더멘털 포함.

## 종합 투자의견
다음 형식으로 반드시 작성:
- 투자의견: [강력매수 / 매수 / 중립 / 매도 / 강력매도]
- 목표주가: [가격 또는 "정보 없음"]
- 리스크: [상/중/하]
- 한 줄 요약: [종목에 대한 핵심 판단]

추정 정보는 "추정:" 접두어를 붙이세요. 실제 출처가 있으면 (출처: ...) 형식으로 명시하세요.`;

type SectionType = "positive" | "negative" | "neutral" | "short" | "long" | "summary";

interface Section {
  type: SectionType;
  title: string;
  items: string[];
  text?: string;
}

function parseResponse(text: string): Section[] {
  const sections: Section[] = [];
  const sectionMap: Record<string, SectionType> = {
    "호재": "positive",
    "악재": "negative",
    "중립": "neutral",
    "단기 전망": "short",
    "중장기 전망": "long",
    "종합 투자의견": "summary",
  };
  const parts = text.split(/^## /m).filter(Boolean);
  for (const part of parts) {
    const lines = part.trim().split("\n");
    const title = lines[0].trim();
    const body = lines.slice(1).join("\n").trim();
    const items = lines.slice(1).filter(l => l.trim().startsWith("-")).map(l => l.replace(/^-\s*/, "").trim());
    const typeKey = Object.keys(sectionMap).find(k => title.includes(k));
    if (typeKey) {
      sections.push({ type: sectionMap[typeKey], title, items, text: body });
    }
  }
  return sections;
}

const sectionStyles: Record<SectionType, { border: string; bg: string; icon: React.ReactNode; cols?: string }> = {
  positive: { border: "border-red-200 dark:border-red-900", bg: "bg-red-50 dark:bg-red-950/50", icon: <TrendingUp className="w-4 h-4 text-red-500" /> },
  negative: { border: "border-blue-200 dark:border-blue-900", bg: "bg-blue-50 dark:bg-blue-950/50", icon: <TrendingDown className="w-4 h-4 text-blue-500" /> },
  neutral:  { border: "border-yellow-200 dark:border-yellow-900", bg: "bg-yellow-50 dark:bg-yellow-950/50", icon: <Minus className="w-4 h-4 text-yellow-500" /> },
  short:    { border: "border-purple-200 dark:border-purple-900", bg: "bg-purple-50 dark:bg-purple-950/50", icon: <Calendar className="w-4 h-4 text-purple-500" /> },
  long:     { border: "border-indigo-200 dark:border-indigo-900", bg: "bg-indigo-50 dark:bg-indigo-950/50", icon: <TrendingUp className="w-4 h-4 text-indigo-500" />, cols: "md:col-span-2" },
  summary:  { border: "border-green-200 dark:border-green-900", bg: "bg-green-50 dark:bg-green-950/50", icon: <Target className="w-4 h-4 text-green-600" />, cols: "md:col-span-2" },
};

interface HoldingItem { id: string; name: string; ticker: string; }

export default function NewsPage() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState("");
  const [analyzed, setAnalyzed] = useState("");
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [usedSources, setUsedSources] = useState<string[]>([]);
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [watchlist, setWatchlist] = useState<HoldingItem[]>([]);

  useEffect(() => {
    // API 기반으로 로드 (localStorage 대신)
    Promise.all([
      fetch("/api/portfolio/holdings").then(r => r.ok ? r.json() : []),
      fetch("/api/portfolio/watchlist").then(r => r.ok ? r.json() : { groups: [], ungroupedItems: [] }),
    ]).then(([holdData, watchData]) => {
      if (Array.isArray(holdData)) {
        setHoldings(holdData.map((h: { id: string; name: string; ticker: string }) => ({ id: h.id, name: h.name, ticker: h.ticker })));
      }
      const items: HoldingItem[] = [
        ...((watchData.groups ?? []).flatMap((g: { items?: HoldingItem[] }) => g.items ?? [])),
        ...(watchData.ungroupedItems ?? []),
      ];
      setWatchlist(items.map(w => ({ id: w.id, name: w.name, ticker: w.ticker })));
    });
  }, []);

  async function handleAnalyze(target?: string) {
    const t = (target ?? ticker).trim();
    if (!t) return;
    setLoading(true); setError(""); setSections([]); setAnalyzedAt(null); setUsedSources([]);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPT,
          userMessage: `${t} 종목의 최신 뉴스, 시장 동향, 재무 지표를 검색하여 종합 분석해주세요. 가능하면 최근 애널리스트 목표주가 및 투자의견도 포함하세요.`,
          useSearch: true,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setSections(parseResponse(data.text));
      setAnalyzed(t);
      setAnalyzedAt(new Date().toLocaleString("ko-KR"));
      setUsedSources(data.sources ?? []);
    } catch {
      setError("분석 실패. GROQ_API_KEY 및 TAVILY_API_KEY 환경변수를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">AI 뉴스 분석</h2>
        <p className="text-sm text-muted-foreground">Tavily · Finnhub · Google News + Groq AI — 호재/악재/단기·중장기 전망·목표가 종합 분석</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="종목명 또는 티커 (삼성전자, AAPL, 테슬라...)"
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAnalyze()}
          className="flex-1"
        />
        <Button onClick={() => handleAnalyze()} disabled={loading || !ticker.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          분석
        </Button>
      </div>

      {holdings.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">보유 종목 바로 조회</p>
          <div className="flex flex-wrap gap-1.5">
            {holdings.map(h => (
              <button
                key={h.id}
                onClick={() => handleAnalyze(h.name)}
                disabled={loading}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  analyzed === h.name ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-border"
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {watchlist.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">관심 종목</p>
          <div className="flex flex-wrap gap-1.5">
            {watchlist.map(w => (
              <button
                key={w.id}
                onClick={() => handleAnalyze(w.name)}
                disabled={loading}
                className={`text-xs px-3 py-1.5 rounded-full border border-dashed transition-colors ${
                  analyzed === w.name ? "bg-primary text-primary-foreground border-solid border-primary" : "hover:bg-accent border-border"
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {loading && (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
          <Loader2 className="w-7 h-7 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium">뉴스 수집 + AI 분석 중...</p>
            <p className="text-xs mt-1 opacity-60">실시간 검색 기반 — 10~20초 소요</p>
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="font-semibold text-sm">📊 {analyzed} 종합 분석</span>
              {analyzedAt && <span className="text-xs text-muted-foreground ml-2">{analyzedAt}</span>}
              {usedSources.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {usedSources.map(src => (
                    <span key={src} className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleAnalyze(analyzed)} disabled={loading}>
              <RefreshCw className="w-3 h-3" />새로고침
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.map((section, i) => {
              const style = sectionStyles[section.type];
              return (
                <Card key={i} className={`border ${style.border} ${style.cols ?? ""}`}>
                  <CardHeader className={`pb-2 pt-3 px-4 ${style.bg} rounded-t-lg`}>
                    <CardTitle className="text-sm flex items-center gap-2">{style.icon}{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 py-3">
                    {section.items.length > 0 ? (
                      <ul className="space-y-1.5">
                        {section.items.map((item, j) => (
                          <li key={j} className="text-sm flex gap-2">
                            <span className="text-muted-foreground shrink-0">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm whitespace-pre-line">{section.text}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">⚠️ AI 분석은 참고용입니다. 투자 결정은 본인 책임입니다.</p>
        </div>
      )}

      {!loading && sections.length === 0 && !error && (
        <div className="text-center py-14 text-muted-foreground">
          <p className="text-4xl mb-3">📰</p>
          <p>종목을 입력하거나 보유/관심 종목을 클릭하세요</p>
          <p className="text-sm mt-1 opacity-60">호재·악재·단기전망·중장기전망·목표가 종합 분석</p>
        </div>
      )}
    </div>
  );
}
