"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, Minus, RefreshCw, Target, Calendar, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const SYSTEM_PROMPT = `당신은 CFA 자격증을 보유한 주식 전문 애널리스트입니다. 최신 뉴스와 시장 데이터를 조사하고 분석하세요.

반드시 다음 형식으로 응답하세요:

## 호재 요인
- 항목 (출처/날짜)

## 악재 요인
- 항목 (출처/날짜)

## 중립/주목 요인
- 항목

## 단기 전망 (1~4주)
내용. 주요 이벤트 포함.

## 중장기 전망 (3~12개월)
내용. 섹터 트렌드, 펀더멘털 포함.

## 종합 투자의견
- 투자의견: [강력매수 / 매수 / 중립 / 매도 / 강력매도]
- 목표주가: [가격 또는 "정보 없음"]
- 리스크: [상/중/하]
- 한 줄 요약: [핵심 판단]

추정 정보는 "추정:" 접두어를 붙이세요.`;

type SectionType = "positive" | "negative" | "neutral" | "short" | "long" | "summary";

interface Section { type: SectionType; title: string; items: string[]; text?: string; }
interface CachedResult { sections: Section[]; sources: string[]; cachedAt: string; }

const CACHE_KEY_PREFIX = "news_v2_";

function loadCache(ticker: string): CachedResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + ticker);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCache(ticker: string, data: CachedResult) {
  try { localStorage.setItem(CACHE_KEY_PREFIX + ticker, JSON.stringify(data)); } catch { /* ignore */ }
}

function getCachedTickers(): string[] {
  try {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_KEY_PREFIX))
      .map(k => k.slice(CACHE_KEY_PREFIX.length))
      .sort();
  } catch { return []; }
}

function parseResponse(text: string): Section[] {
  const sections: Section[] = [];
  const sectionMap: Record<string, SectionType> = {
    "호재": "positive", "악재": "negative", "중립": "neutral",
    "단기 전망": "short", "중장기 전망": "long", "종합 투자의견": "summary",
  };
  const parts = text.split(/^## /m).filter(Boolean);
  for (const part of parts) {
    const lines = part.trim().split("\n");
    const title = lines[0].trim();
    const body = lines.slice(1).join("\n").trim();
    const items = lines.slice(1).filter(l => l.trim().startsWith("-")).map(l => l.replace(/^-\s*/, "").trim());
    const typeKey = Object.keys(sectionMap).find(k => title.includes(k));
    if (typeKey) sections.push({ type: sectionMap[typeKey], title, items, text: body });
  }
  return sections;
}

// 종합 투자의견 파싱
function parseSummary(section: Section) {
  const find = (key: string) => {
    const line = section.items.find(i => i.startsWith(key)) ?? section.text?.split("\n").find(l => l.includes(key)) ?? "";
    return line.replace(/^.*?:\s*/, "").trim();
  };
  return {
    opinion: find("투자의견"),
    target: find("목표주가"),
    risk: find("리스크"),
    summary: find("한 줄 요약"),
  };
}

const OPINION_COLORS: Record<string, string> = {
  "강력매수": "bg-red-500 text-white",
  "매수": "bg-red-300 text-red-900",
  "중립": "bg-gray-200 text-gray-700",
  "매도": "bg-blue-300 text-blue-900",
  "강력매도": "bg-blue-500 text-white",
};
const RISK_COLORS: Record<string, string> = {
  "상": "text-red-500", "중": "text-amber-500", "하": "text-green-500",
};

const SECTION_CONFIGS: Record<SectionType, { icon: React.ReactNode; borderColor: string; bgColor: string }> = {
  positive: { icon: <TrendingUp className="w-3.5 h-3.5 text-red-500" />, borderColor: "border-red-200 dark:border-red-900", bgColor: "bg-red-50 dark:bg-red-950/30" },
  negative: { icon: <TrendingDown className="w-3.5 h-3.5 text-blue-500" />, borderColor: "border-blue-200 dark:border-blue-900", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  neutral:  { icon: <Minus className="w-3.5 h-3.5 text-yellow-500" />, borderColor: "border-yellow-200 dark:border-yellow-900", bgColor: "bg-yellow-50 dark:bg-yellow-950/30" },
  short:    { icon: <Calendar className="w-3.5 h-3.5 text-purple-500" />, borderColor: "border-purple-200 dark:border-purple-900", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
  long:     { icon: <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />, borderColor: "border-indigo-200 dark:border-indigo-900", bgColor: "bg-indigo-50 dark:bg-indigo-950/30" },
  summary:  { icon: <Target className="w-3.5 h-3.5 text-green-600" />, borderColor: "border-green-200 dark:border-green-900", bgColor: "bg-green-50 dark:bg-green-950/30" },
};

const MAX_ITEMS = 3; // 기본 표시 항목 수

function SectionCard({ section }: { section: Section }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SECTION_CONFIGS[section.type];

  if (section.type === "summary") {
    const { opinion, target, risk, summary } = parseSummary(section);
    return (
      <div className={`rounded-lg border ${cfg.borderColor} ${cfg.bgColor} p-3 space-y-2`}>
        <div className="flex items-center gap-2 flex-wrap">
          {cfg.icon}
          <span className="text-xs font-semibold text-muted-foreground">{section.title}</span>
          {opinion && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${OPINION_COLORS[opinion] ?? "bg-gray-200"}`}>{opinion}</span>}
          {target && <span className="text-xs font-medium">🎯 {target}</span>}
          {risk && <span className={`text-xs font-bold ${RISK_COLORS[risk] ?? ""}`}>리스크 {risk}</span>}
        </div>
        {summary && <p className="text-sm font-medium">{summary}</p>}
      </div>
    );
  }

  const hasItems = section.items.length > 0;
  const visibleItems = hasItems
    ? (expanded ? section.items : section.items.slice(0, MAX_ITEMS))
    : [];
  const textPreview = !hasItems && section.text
    ? (expanded ? section.text : section.text.split("\n").slice(0, 2).join("\n"))
    : "";
  const canExpand = hasItems ? section.items.length > MAX_ITEMS : (section.text?.split("\n").length ?? 0) > 2;

  return (
    <div className={`rounded-lg border ${cfg.borderColor}`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${cfg.bgColor} rounded-t-lg`}>
        {cfg.icon}
        <span className="text-xs font-semibold flex-1">{section.title}</span>
        {canExpand && (
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
      <div className="px-3 py-2">
        {hasItems ? (
          <ul className="space-y-1">
            {visibleItems.map((item, j) => (
              <li key={j} className="text-xs flex gap-1.5 leading-relaxed">
                <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
            {!expanded && section.items.length > MAX_ITEMS && (
              <li className="text-xs text-muted-foreground">+{section.items.length - MAX_ITEMS}개 더...</li>
            )}
          </ul>
        ) : (
          <p className="text-xs whitespace-pre-line leading-relaxed text-muted-foreground">{textPreview}</p>
        )}
      </div>
    </div>
  );
}

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
  const [cachedTickers, setCachedTickers] = useState<string[]>([]);

  useEffect(() => {
    setCachedTickers(getCachedTickers());
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

  function loadFromCache(t: string) {
    const cached = loadCache(t);
    if (cached) {
      setSections(cached.sections);
      setAnalyzed(t);
      setAnalyzedAt(cached.cachedAt);
      setUsedSources(cached.sources);
      setError("");
    }
  }

  async function handleAnalyze(target?: string, forceRefresh = false) {
    const t = (target ?? ticker).trim();
    if (!t) return;

    // 캐시 있고 강제 갱신 아닌 경우 → 캐시 표시
    if (!forceRefresh) {
      const cached = loadCache(t);
      if (cached) {
        loadFromCache(t);
        return;
      }
    }

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
      const parsed = parseResponse(data.text);
      const now = new Date().toLocaleString("ko-KR");
      setSections(parsed);
      setAnalyzed(t);
      setAnalyzedAt(now);
      setUsedSources(data.sources ?? []);
      saveCache(t, { sections: parsed, sources: data.sources ?? [], cachedAt: now });
      setCachedTickers(getCachedTickers());
    } catch {
      setError("분석 실패. GROQ_API_KEY 및 TAVILY_API_KEY 환경변수를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  // 캐시에 없는 보유/관심 종목
  const holdingNames = holdings.map(h => h.name);
  const watchlistNames = watchlist.map(w => w.name);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-0.5">AI 뉴스 분석</h2>
        <p className="text-xs text-muted-foreground">Tavily + Groq AI — 호재/악재/전망/목표가 분석</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="종목명 또는 티커 (삼성전자, AAPL...)"
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

      {/* 보유/관심 종목 */}
      {holdingNames.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">보유 종목</p>
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
      {watchlistNames.length > 0 && (
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

      {/* 이전 검색 기록 */}
      {cachedTickers.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" /> 이전 검색 기록
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cachedTickers.map(t => (
              <button key={t} onClick={() => loadFromCache(t)} disabled={loading}
                className={`text-xs px-2.5 py-1 rounded-full border border-dashed transition-colors ${
                  analyzed === t ? "bg-muted border-solid" : "hover:bg-accent border-border text-muted-foreground"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <Loader2 className="w-7 h-7 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium">뉴스 수집 + AI 분석 중...</p>
            <p className="text-xs mt-1 opacity-60">실시간 검색 기반 — 10~20초 소요</p>
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="font-semibold text-sm">📊 {analyzed} 분석</span>
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
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
              onClick={() => handleAnalyze(analyzed, true)} disabled={loading}>
              <RefreshCw className="w-3 h-3" />새로 분석
            </Button>
          </div>

          {/* 종합 투자의견 먼저 */}
          {sections.filter(s => s.type === "summary").map((s, i) => <SectionCard key={i} section={s} />)}

          {/* 나머지 섹션 2열 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sections.filter(s => s.type !== "summary").map((s, i) => <SectionCard key={i} section={s} />)}
          </div>

          <p className="text-xs text-muted-foreground">⚠️ AI 분석은 참고용입니다. 투자 결정은 본인 책임입니다.</p>
        </div>
      )}

      {!loading && sections.length === 0 && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">📰</p>
          <p className="text-sm">종목을 입력하거나 보유/관심 종목을 클릭하세요</p>
          <p className="text-xs mt-1 opacity-60">호재·악재·단기전망·중장기전망·목표가 종합 분석</p>
        </div>
      )}
    </div>
  );
}
