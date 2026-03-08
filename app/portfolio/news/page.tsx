"use client";

import { useState } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SYSTEM_PROMPT = `당신은 주식 전문 애널리스트입니다. 사용자가 입력한 종목에 대해 최근 시장 동향, 호재/악재 요인, 단기 전망을 구조화해서 한국어로 설명하세요.

반드시 다음 형식으로 응답하세요:
## 호재 요인
- 항목1
- 항목2

## 악재 요인
- 항목1
- 항목2

## 중립/주목 요인
- 항목1

## 단기 전망
전망 내용`;

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
    if (typeKey) {
      sections.push({ type: sectionMap[typeKey], title, items });
    }
  }
  return sections;
}

const sectionStyles = {
  positive: { border: "border-red-200 dark:border-red-900", bg: "bg-red-50 dark:bg-red-950/50", icon: <TrendingUp className="w-4 h-4 text-red-500" />, badge: "bg-red-500" },
  negative: { border: "border-blue-200 dark:border-blue-900", bg: "bg-blue-50 dark:bg-blue-950/50", icon: <TrendingDown className="w-4 h-4 text-blue-500" />, badge: "bg-blue-500" },
  neutral:  { border: "border-yellow-200 dark:border-yellow-900", bg: "bg-yellow-50 dark:bg-yellow-950/50", icon: <Minus className="w-4 h-4 text-yellow-500" />, badge: "bg-yellow-500" },
  outlook:  { border: "border-purple-200 dark:border-purple-900", bg: "bg-purple-50 dark:bg-purple-950/50", icon: <TrendingUp className="w-4 h-4 text-purple-500" />, badge: "bg-purple-500" },
};

export default function NewsPage() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const [analyzed, setAnalyzed] = useState("");

  async function handleAnalyze() {
    if (!ticker.trim()) return;
    setLoading(true);
    setError("");
    setSections([]);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPT,
          userMessage: `${ticker} 종목에 대해 분석해주세요.`,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setRawText(data.text);
      setSections(parseResponse(data.text));
      setAnalyzed(ticker.trim());
    } catch (e) {
      setError("API 호출 실패. ANTHROPIC_API_KEY를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">AI 뉴스 분석</h2>
        <p className="text-sm text-muted-foreground">종목명 또는 티커를 입력하면 AI가 시장 동향을 분석합니다</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="예: 삼성전자, AAPL, 테슬라..."
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAnalyze()}
          className="flex-1"
        />
        <Button onClick={handleAnalyze} disabled={loading || !ticker.trim()}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          분석하기
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-3" />
          <p>AI가 {ticker} 분석 중...</p>
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground">📊 {analyzed} 분석 결과</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.map((section, i) => {
              const style = sectionStyles[section.type];
              return (
                <Card key={i} className={`border ${style.border}`}>
                  <CardHeader className={`pb-2 pt-3 px-4 ${style.bg} rounded-t-lg`}>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {style.icon}
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 py-3">
                    {section.items.length > 0 ? (
                      <ul className="space-y-1.5">
                        {section.items.map((item, j) => (
                          <li key={j} className="text-sm flex gap-2">
                            <span className="text-muted-foreground">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">{rawText.split("## ").find(s => s.startsWith(section.title))?.replace(section.title, "").trim()}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {!loading && sections.length === 0 && !error && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📰</p>
          <p>종목을 입력하고 분석하기 버튼을 눌러보세요</p>
          <p className="text-sm mt-1 opacity-60">AI가 호재/악재/단기전망을 분석해드립니다</p>
        </div>
      )}
    </div>
  );
}
