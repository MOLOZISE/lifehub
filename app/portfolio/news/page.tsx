"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHoldings, getWatchlist } from "@/lib/storage";

const SYSTEM_PROMPT = `당신은 주식 전문 애널리스트입니다. Google 검색을 통해 입력한 종목의 최신 뉴스와 시장 동향을 조사하고, 실제 최근 정보를 바탕으로 분석하세요.

반드시 다음 형식으로 응답하세요:
## 호재 요인
- 항목 (출처/날짜 포함 시 우선)

## 악재 요인
- 항목

## 중립/주목 요인
- 항목

## 단기 전망
전망 내용 (최신 데이터 기반)

최신 뉴스를 검색하여 실제 일어난 사건 기반으로 분석하세요. 추정은 "추정:" 접두어를 붙이세요.`;

interface Section {
  type: "positive" | "negative" | "neutral" | "outlook";
  title: string;
  items: string[];
}

function parseResponse(text: string): Section[] {
  const sections: Section[] = [];
  const sectionMap: Record<string, Section["type"]> = {
    "호재": "positive", "악재": "negative", "중립": "neutral", "단기 전망": "outlook",
  };
  const parts = text.split(/^## /m).filter(Boolean);
  for (const part of parts) {
    const lines = part.trim().split("\n");
    const title = lines[0].trim();
    const items = lines.slice(1).filter(l => l.trim().startsWith("-")).map(l => l.replace(/^-\s*/, "").trim());
    const typeKey = Object.keys(sectionMap).find(k => title.includes(k));
    if (typeKey) sections.push({ type: sectionMap[typeKey], title, items });
  }
  return sections;
}

const sectionStyles = {
  positive: { border: "border-red-200 dark:border-red-900", bg: "bg-red-50 dark:bg-red-950/50", icon: <TrendingUp className="w-4 h-4 text-red-500" /> },
  negative: { border: "border-blue-200 dark:border-blue-900", bg: "bg-blue-50 dark:bg-blue-950/50", icon: <TrendingDown className="w-4 h-4 text-blue-500" /> },
  neutral:  { border: "border-yellow-200 dark:border-yellow-900", bg: "bg-yellow-50 dark:bg-yellow-950/50", icon: <Minus className="w-4 h-4 text-yellow-500" /> },
  outlook:  { border: "border-purple-200 dark:border-purple-900", bg: "bg-purple-50 dark:bg-purple-950/50", icon: <TrendingUp className="w-4 h-4 text-purple-500" /> },
};

export default function NewsPage() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const [analyzed, setAnalyzed] = useState("");
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<{ id: string; name: string; ticker: string }[]>([]);
  const [watchlist, setWatchlist] = useState<{ id: string; name: string; ticker: string }[]>([]);

  useEffect(() => {
    setHoldings(getHoldings().map(h => ({ id: h.id, name: h.name, ticker: h.ticker })));
    setWatchlist(getWatchlist().map(w => ({ id: w.id, name: w.name, ticker: w.ticker })));
  }, []);

  async function handleAnalyze(target?: string) {
    const t = target ?? ticker.trim();
    if (!t) return;
    setLoading(true); setError(""); setSections([]); setAnalyzedAt(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPT,
          userMessage: `${t} 종목의 최신 뉴스와 시장 동향을 Google 검색으로 조사하고 분석해주세요.`,
          useSearch: true,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setRawText(data.text);
      setSections(parseResponse(data.text));
      setAnalyzed(t);
      setAnalyzedAt(new Date().toLocaleString("ko-KR"));
    } catch {
      setError("분석 실패. .env.local 의 GEMINI_API_KEY를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">AI 뉴스 분석</h2>
        <p className="text-sm text-muted-foreground">Google 검색 기반 실시간 뉴스 · Gemini 2.0 Flash</p>
      </div>

      <div className="flex gap-2">
        <Input placeholder="종목명 또는 티커 (삼성전자, AAPL, 테슬라...)" value={ticker}
          onChange={e => setTicker(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAnalyze()} className="flex-1" />
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
              <button key={h.id} onClick={() => handleAnalyze(h.name)} disabled={loading}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  analyzed === h.name ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-border"
                }`}>
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
              <button key={w.id} onClick={() => handleAnalyze(w.name)} disabled={loading}
                className={`text-xs px-3 py-1.5 rounded-full border border-dashed transition-colors ${
                  analyzed === w.name ? "bg-primary text-primary-foreground border-solid border-primary" : "hover:bg-accent border-border"
                }`}>
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
            <p className="text-sm font-medium">Google 검색으로 최신 뉴스 수집 중...</p>
            <p className="text-xs mt-1 opacity-60">실시간 검색이라 10~20초 소요될 수 있습니다</p>
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-sm">📊 {analyzed} 분석 결과</span>
              {analyzedAt && <span className="text-xs text-muted-foreground ml-2">{analyzedAt}</span>}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleAnalyze(analyzed)} disabled={loading}>
              <RefreshCw className="w-3 h-3" />새로고침
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.map((section, i) => {
              const style = sectionStyles[section.type];
              return (
                <Card key={i} className={`border ${style.border}`}>
                  <CardHeader className={`pb-2 pt-3 px-4 ${style.bg} rounded-t-lg`}>
                    <CardTitle className="text-sm flex items-center gap-2">{style.icon}{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 py-3">
                    {section.items.length > 0 ? (
                      <ul className="space-y-1.5">
                        {section.items.map((item, j) => (
                          <li key={j} className="text-sm flex gap-2">
                            <span className="text-muted-foreground shrink-0">•</span><span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {rawText.split("## ").find(s => s.startsWith(section.title))?.replace(section.title, "").trim()}
                      </p>
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
          <p className="text-sm mt-1 opacity-60">Google 검색 기반 실시간 뉴스 분석</p>
        </div>
      )}
    </div>
  );
}
