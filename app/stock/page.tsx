"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { TradingViewChart } from "@/components/chart/TradingViewChart";
import {
  Search, Loader2, RefreshCw, Star, StarOff,
  TrendingUp, TrendingDown, Minus, Target, Calendar, ChevronDown, ChevronUp, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MarketOverview } from "@/components/market/MarketOverview";
import { toast } from "sonner";
import type { OHLCVBar } from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = "시황" | "차트" | "AI분석" | "관심 종목";
type Period = "1W" | "1M" | "3M" | "1Y";

interface StockPrice {
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
}

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  market: "KR" | "US";
  currency: string;
  currentPrice: number;
}

interface WatchlistGroup {
  id: string;
  name: string;
  emoji: string;
  color: string;
  items: WatchlistItem[];
}

// ─── Popular stocks ─────────────────────────────────────────────────────────────

const POPULAR_KR = [
  { ticker: "005930", name: "삼성전자", market: "KR" as const },
  { ticker: "000660", name: "SK하이닉스", market: "KR" as const },
  { ticker: "035420", name: "NAVER", market: "KR" as const },
  { ticker: "005380", name: "현대차", market: "KR" as const },
  { ticker: "051910", name: "LG화학", market: "KR" as const },
  { ticker: "006400", name: "삼성SDI", market: "KR" as const },
  { ticker: "035720", name: "카카오", market: "KR" as const },
  { ticker: "207940", name: "삼성바이오로직스", market: "KR" as const },
  { ticker: "068270", name: "셀트리온", market: "KR" as const },
  { ticker: "000270", name: "기아", market: "KR" as const },
  { ticker: "096770", name: "SK이노베이션", market: "KR" as const },
  { ticker: "034020", name: "두산에너빌리티", market: "KR" as const },
];

const POPULAR_US = [
  { ticker: "AAPL", name: "Apple", market: "US" as const },
  { ticker: "NVDA", name: "NVIDIA", market: "US" as const },
  { ticker: "MSFT", name: "Microsoft", market: "US" as const },
  { ticker: "GOOGL", name: "Alphabet", market: "US" as const },
  { ticker: "AMZN", name: "Amazon", market: "US" as const },
  { ticker: "META", name: "Meta", market: "US" as const },
  { ticker: "TSLA", name: "Tesla", market: "US" as const },
  { ticker: "TSM", name: "TSMC", market: "US" as const },
];

// ─── Utils ──────────────────────────────────────────────────────────────────────

function toYahooTicker(ticker: string, market?: "KR" | "US"): string {
  if (market === "KR" || (!market && /^\d{6}$/.test(ticker))) return `${ticker}.KS`;
  return ticker.toUpperCase();
}

const PERIOD_RANGE: Record<Period, string> = { "1W": "5d", "1M": "1mo", "3M": "3mo", "1Y": "1y" };

// ─── AI News helpers ────────────────────────────────────────────────────────────

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
interface NewsSection { type: SectionType; title: string; items: string[]; text?: string; }
interface CachedResult { sections: NewsSection[]; sources: string[]; cachedAt: string; }

const CACHE_KEY_PREFIX = "news_v2_";

function loadCache(ticker: string): CachedResult | null {
  try { const raw = localStorage.getItem(CACHE_KEY_PREFIX + ticker); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function saveCache(ticker: string, data: CachedResult) {
  try { localStorage.setItem(CACHE_KEY_PREFIX + ticker, JSON.stringify(data)); } catch { /* ignore */ }
}
function getCachedTickers(): string[] {
  try {
    return Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX))
      .map(k => k.slice(CACHE_KEY_PREFIX.length)).sort();
  } catch { return []; }
}

function parseNewsResponse(text: string): NewsSection[] {
  const sectionMap: Record<string, SectionType> = {
    "호재": "positive", "악재": "negative", "중립": "neutral",
    "단기 전망": "short", "중장기 전망": "long", "종합 투자의견": "summary",
  };
  const parts = text.split(/^## /m).filter(Boolean);
  return parts.flatMap(part => {
    const lines = part.trim().split("\n");
    const title = lines[0].trim();
    const body = lines.slice(1).join("\n").trim();
    const items = lines.slice(1).filter(l => l.trim().startsWith("-")).map(l => l.replace(/^-\s*/, "").trim());
    const typeKey = Object.keys(sectionMap).find(k => title.includes(k));
    return typeKey ? [{ type: sectionMap[typeKey], title, items, text: body }] : [];
  });
}

function parseSummary(section: NewsSection) {
  const find = (key: string) => {
    const line = section.items.find(i => i.startsWith(key)) ?? section.text?.split("\n").find(l => l.includes(key)) ?? "";
    return line.replace(/^.*?:\s*/, "").trim();
  };
  return { opinion: find("투자의견"), target: find("목표주가"), risk: find("리스크"), summary: find("한 줄 요약") };
}

const OPINION_COLORS: Record<string, string> = {
  "강력매수": "bg-red-500 text-white", "매수": "bg-red-300 text-red-900",
  "중립": "bg-gray-200 text-gray-700", "매도": "bg-blue-300 text-blue-900",
  "강력매도": "bg-blue-500 text-white",
};
const RISK_COLORS: Record<string, string> = { "상": "text-red-500", "중": "text-amber-500", "하": "text-green-500" };
const SECTION_CONFIGS: Record<SectionType, { icon: React.ReactNode; borderColor: string; bgColor: string }> = {
  positive: { icon: <TrendingUp className="w-3.5 h-3.5 text-red-500" />, borderColor: "border-red-200 dark:border-red-900", bgColor: "bg-red-50 dark:bg-red-950/30" },
  negative: { icon: <TrendingDown className="w-3.5 h-3.5 text-blue-500" />, borderColor: "border-blue-200 dark:border-blue-900", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  neutral:  { icon: <Minus className="w-3.5 h-3.5 text-yellow-500" />, borderColor: "border-yellow-200 dark:border-yellow-900", bgColor: "bg-yellow-50 dark:bg-yellow-950/30" },
  short:    { icon: <Calendar className="w-3.5 h-3.5 text-purple-500" />, borderColor: "border-purple-200 dark:border-purple-900", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
  long:     { icon: <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />, borderColor: "border-indigo-200 dark:border-indigo-900", bgColor: "bg-indigo-50 dark:bg-indigo-950/30" },
  summary:  { icon: <Target className="w-3.5 h-3.5 text-green-600" />, borderColor: "border-green-200 dark:border-green-900", bgColor: "bg-green-50 dark:bg-green-950/30" },
};

const MAX_ITEMS = 3;

function NewsSectionCard({ section }: { section: NewsSection }) {
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
  const visibleItems = hasItems ? (expanded ? section.items : section.items.slice(0, MAX_ITEMS)) : [];
  const textPreview = !hasItems && section.text
    ? (expanded ? section.text : section.text.split("\n").slice(0, 2).join("\n")) : "";
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
                <span className="text-muted-foreground shrink-0 mt-0.5">•</span><span>{item}</span>
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

// ─── Stock Card ─────────────────────────────────────────────────────────────────

function StockCard({
  ticker, name, market, price, inWatchlist,
  onAddWatchlist, onChart, onAnalyze,
}: {
  ticker: string; name: string; market: "KR" | "US";
  price: StockPrice | null;
  inWatchlist: boolean;
  onAddWatchlist: () => void;
  onChart: () => void;
  onAnalyze: () => void;
}) {
  const up = price ? price.change >= 0 : null;
  const fmtPrice = (p: StockPrice) =>
    p.currency === "KRW"
      ? "₩" + Math.round(p.price).toLocaleString("ko-KR")
      : "$" + p.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtChange = (p: StockPrice) =>
    p.currency === "KRW"
      ? (p.change >= 0 ? "+" : "") + Math.round(p.change).toLocaleString("ko-KR")
      : (p.change >= 0 ? "+" : "") + p.change.toFixed(2);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-muted/30 hover:bg-muted/60 transition-colors group">
      {/* 왼쪽: 종목 정보 */}
      <button className="flex-1 min-w-0 text-left" onClick={onChart}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] text-muted-foreground">{market === "KR" ? "🇰🇷" : "🇺🇸"}</span>
          <span className="font-semibold text-sm truncate">{name}</span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden sm:inline">{ticker}</span>
        </div>
        {price ? (
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tabular-nums">{fmtPrice(price)}</span>
            <span className={`text-xs font-medium tabular-nums ${up ? "text-red-500" : "text-blue-500"}`}>
              {fmtChange(price)} ({up ? "+" : ""}{price.changePercent.toFixed(2)}%)
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">조회 중...</span>
        )}
      </button>

      {/* 오른쪽: 액션 버튼 */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onAnalyze}
          className="px-2 py-1 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-colors text-[10px] font-semibold"
          title="AI 분석"
        >
          AI
        </button>
        <button
          onClick={onAddWatchlist}
          className={`p-1.5 rounded-lg transition-colors ${inWatchlist ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
          title={inWatchlist ? "관심 종목에서 제거" : "관심 종목 추가"}
        >
          {inWatchlist ? <Star className="w-3.5 h-3.5 fill-current" /> : <Star className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Watchlist Item Card (관심 종목 탭 전용, 삭제 버튼) ────────────────────────

function WatchlistItemCard({
  item, price, onChart, onAnalyze, onDelete,
}: {
  item: WatchlistItem;
  price: StockPrice | null;
  onChart: () => void;
  onAnalyze: () => void;
  onDelete: () => void;
}) {
  const up = price ? price.change >= 0 : null;
  const fmtPrice = (p: StockPrice) =>
    p.currency === "KRW"
      ? "₩" + Math.round(p.price).toLocaleString("ko-KR")
      : "$" + p.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtChange = (p: StockPrice) =>
    p.currency === "KRW"
      ? (p.change >= 0 ? "+" : "") + Math.round(p.change).toLocaleString("ko-KR")
      : (p.change >= 0 ? "+" : "") + p.change.toFixed(2);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-muted/30 hover:bg-muted/60 transition-colors group">
      <button className="flex-1 min-w-0 text-left" onClick={onChart}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] text-muted-foreground">{item.market === "KR" ? "🇰🇷" : "🇺🇸"}</span>
          <span className="font-semibold text-sm truncate">{item.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden sm:inline">{item.ticker}</span>
        </div>
        {price ? (
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tabular-nums">{fmtPrice(price)}</span>
            <span className={`text-xs font-medium tabular-nums ${up ? "text-red-500" : "text-blue-500"}`}>
              {fmtChange(price)} ({up ? "+" : ""}{price.changePercent.toFixed(2)}%)
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">조회 중...</span>
        )}
      </button>
      <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
        <button onClick={onAnalyze}
          className="px-2 py-1 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-colors text-[10px] font-semibold">
          AI
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
          <StarOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [tab, setTab] = useState<Tab>("시황");

  // Prices for popular stocks
  const [krPrices, setKrPrices] = useState<Record<string, StockPrice>>({});
  const [usPrices, setUsPrices] = useState<Record<string, StockPrice>>({});
  const [priceLoading, setPriceLoading] = useState(false);

  // Watchlist
  const [watchlistGroups, setWatchlistGroups] = useState<WatchlistGroup[]>([]);
  const [watchlistUngrouped, setWatchlistUngrouped] = useState<WatchlistItem[]>([]);
  // flat list for isInWatchlist checks
  const watchlistItems = useMemo<WatchlistItem[]>(() =>
    [...watchlistGroups.flatMap(g => g.items), ...watchlistUngrouped],
    [watchlistGroups, watchlistUngrouped]
  );

  // Chart state
  const [chartInputTicker, setChartInputTicker] = useState("");
  const [chartSuggestions, setChartSuggestions] = useState<{ ticker: string; name: string; market: "KR" | "US" }[]>([]);
  const [showChartSugg, setShowChartSugg] = useState(false);
  const [activeTicker, setActiveTicker] = useState<{ yahoo: string; label: string; currency: string } | null>(null);
  const [period, setPeriod] = useState<Period>("3M");
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [chartMeta, setChartMeta] = useState<{ ticker: string; currency: string; regularMarketPrice?: number; longName: string; bars: OHLCVBar[] } | null>(null);

  // AI analysis state
  const [aiTicker, setAiTicker] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSections, setAiSections] = useState<NewsSection[]>([]);
  const [aiError, setAiError] = useState("");
  const [aiAnalyzed, setAiAnalyzed] = useState("");
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState<string | null>(null);
  const [aiSources, setAiSources] = useState<string[]>([]);
  const [cachedTickers, setCachedTickers] = useState<string[]>([]);

  // Watchlist tab state
  const [watchlistPrices, setWatchlistPrices] = useState<Record<string, StockPrice>>({});
  const [watchlistPriceLoading, setWatchlistPriceLoading] = useState(false);
  const [watchlistSearchQ, setWatchlistSearchQ] = useState("");
  const [watchlistSuggestions, setWatchlistSuggestions] = useState<{ ticker: string; name: string; market: "KR" | "US" }[]>([]);
  const [showWatchlistSugg, setShowWatchlistSugg] = useState(false);
  const [addGroupName, setAddGroupName] = useState("");
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addGroupLoading, setAddGroupLoading] = useState(false);
  // which group to add next stock into (null = ungrouped)
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);

  // Holdings for chart/AI shortcuts
  const [holdings, setHoldings] = useState<{ id: string; name: string; ticker: string; market: "KR" | "US"; currency: string }[]>([]);

  useEffect(() => {
    loadWatchlist();
    loadPopularPrices();
    setCachedTickers(getCachedTickers());
    fetch("/api/portfolio/holdings").then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) setHoldings(data.map((h: { id: string; name: string; ticker: string; market: "KR"|"US"; currency: string }) => h));
    });
  }, []);

  async function loadWatchlist() {
    const res = await fetch("/api/portfolio/watchlist");
    if (!res.ok) return;
    const data = await res.json();
    setWatchlistGroups(data.groups ?? []);
    setWatchlistUngrouped(data.ungroupedItems ?? []);
  }

  async function loadPopularPrices() {
    setPriceLoading(true);
    try {
      const krTickers = POPULAR_KR.map(s => `${s.ticker}.KS`).join(",");
      const usTickers = POPULAR_US.map(s => s.ticker).join(",");
      const [krRes, usRes] = await Promise.all([
        fetch(`/api/stock/price?tickers=${encodeURIComponent(krTickers)}`),
        fetch(`/api/stock/price?tickers=${encodeURIComponent(usTickers)}`),
      ]);
      if (krRes.ok) {
        const d = await krRes.json();
        setKrPrices(d.prices ?? {});
      }
      if (usRes.ok) {
        const d = await usRes.json();
        setUsPrices(d.prices ?? {});
      }
    } finally {
      setPriceLoading(false);
    }
  }

  function isInWatchlist(ticker: string): boolean {
    return watchlistItems.some(w => w.ticker === ticker);
  }

  async function toggleWatchlist(ticker: string, name: string, market: "KR" | "US", groupId?: string | null) {
    const existing = watchlistItems.find(w => w.ticker === ticker);
    if (existing) {
      await fetch(`/api/portfolio/watchlist/items/${existing.id}`, { method: "DELETE" });
      await loadWatchlist();
      toast.success(`${name} 관심 종목 제거됨`);
    } else {
      const res = await fetch("/api/portfolio/watchlist/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker, name, market,
          currency: market === "KR" ? "KRW" : "USD",
          currentPrice: 0,
          groupId: groupId ?? null,
        }),
      });
      if (res.ok) {
        await loadWatchlist();
        toast.success(`${name} 관심 종목 추가됨`);
      }
    }
  }

  async function createGroup() {
    if (!addGroupName.trim()) return;
    setAddGroupLoading(true);
    const res = await fetch("/api/portfolio/watchlist/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addGroupName.trim(), emoji: "📌" }),
    });
    if (res.ok) {
      await loadWatchlist();
      setAddGroupName("");
      setShowAddGroup(false);
      toast.success("그룹 생성됨");
    }
    setAddGroupLoading(false);
  }

  async function deleteGroup(groupId: string, groupName: string) {
    if (!confirm(`"${groupName}" 그룹과 하위 종목을 모두 삭제할까요?`)) return;
    await fetch(`/api/portfolio/watchlist/groups/${groupId}`, { method: "DELETE" });
    await loadWatchlist();
    toast.success("그룹 삭제됨");
  }

  async function deleteWatchlistItem(itemId: string, name: string) {
    await fetch(`/api/portfolio/watchlist/items/${itemId}`, { method: "DELETE" });
    await loadWatchlist();
    toast.success(`${name} 제거됨`);
  }

  // ── Chart ──────────────────────────────────────────────────────────────────────

  async function fetchChart(yahooTicker: string, label: string, currency: string, p?: Period) {
    const usePeriod = p ?? period;
    setChartLoading(true);
    setChartError("");
    setChartMeta(null);
    setActiveTicker({ yahoo: yahooTicker, label, currency });
    setTab("차트");
    try {
      const res = await fetch(`/api/chart?ticker=${encodeURIComponent(yahooTicker)}&range=${PERIOD_RANGE[usePeriod]}&interval=1d`);
      const data = await res.json();
      if (data.error) { setChartError(data.error); return; }
      setChartMeta(data);
    } catch {
      setChartError("차트 데이터를 불러오지 못했습니다.");
    } finally {
      setChartLoading(false);
    }
  }

  useEffect(() => {
    if (!chartInputTicker.trim()) { setChartSuggestions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/portfolio/search?q=${encodeURIComponent(chartInputTicker)}`)
        .then(r => r.json()).then(d => { setChartSuggestions(d.slice(0, 8)); setShowChartSugg(true); });
    }, 150);
    return () => clearTimeout(t);
  }, [chartInputTicker]);

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    if (activeTicker) fetchChart(activeTicker.yahoo, activeTicker.label, activeTicker.currency, p);
  }

  const bars = chartMeta?.bars ?? [];
  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  const priceChange = lastBar && prevBar ? lastBar.close - prevBar.close : 0;
  const priceChangePct = prevBar ? (priceChange / prevBar.close) * 100 : 0;
  const isKRW = chartMeta?.currency === "KRW" || activeTicker?.currency === "KRW";

  // ── AI Analysis ─────────────────────────────────────────────────────────────────

  function loadFromAiCache(t: string) {
    const cached = loadCache(t);
    if (cached) {
      setAiSections(cached.sections);
      setAiAnalyzed(t);
      setAiAnalyzedAt(cached.cachedAt);
      setAiSources(cached.sources);
      setAiError("");
    }
  }

  function openAiAnalysis(name: string) {
    setTab("AI분석");
    setAiTicker(name);
    handleAiAnalyze(name);
  }

  async function handleAiAnalyze(target?: string, forceRefresh = false) {
    const t = (target ?? aiTicker).trim();
    if (!t) return;
    if (!forceRefresh) {
      const cached = loadCache(t);
      if (cached) { loadFromAiCache(t); return; }
    }
    setAiLoading(true); setAiError(""); setAiSections([]); setAiAnalyzedAt(null); setAiSources([]);
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
      if (data.error) { setAiError(data.error); return; }
      const parsed = parseNewsResponse(data.text);
      const now = new Date().toLocaleString("ko-KR");
      setAiSections(parsed);
      setAiAnalyzed(t);
      setAiAnalyzedAt(now);
      setAiSources(data.sources ?? []);
      saveCache(t, { sections: parsed, sources: data.sources ?? [], cachedAt: now });
      setCachedTickers(getCachedTickers());
    } catch {
      setAiError("분석 실패. GROQ_API_KEY 및 TAVILY_API_KEY 환경변수를 확인해주세요.");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Watchlist prices ──────────────────────────────────────────────────────────

  async function loadWatchlistPrices() {
    if (watchlistItems.length === 0) return;
    setWatchlistPriceLoading(true);
    try {
      const tickers = watchlistItems.map(w => toYahooTicker(w.ticker, w.market)).join(",");
      const res = await fetch(`/api/stock/price?tickers=${encodeURIComponent(tickers)}`);
      if (res.ok) {
        const d = await res.json();
        setWatchlistPrices(d.prices ?? {});
      }
    } finally {
      setWatchlistPriceLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "관심 종목" && watchlistItems.length > 0) {
      loadWatchlistPrices();
    }
  }, [tab, watchlistItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!watchlistSearchQ.trim()) { setWatchlistSuggestions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/portfolio/search?q=${encodeURIComponent(watchlistSearchQ)}`)
        .then(r => r.json()).then(d => { setWatchlistSuggestions(d.slice(0, 8)); setShowWatchlistSugg(true); });
    }, 150);
    return () => clearTimeout(t);
  }, [watchlistSearchQ]);

  // ── Render ─────────────────────────────────────────────────────────────────────

  const TABS: Tab[] = ["시황", "차트", "AI분석", "관심 종목"];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">증권 동향</h1>
        <p className="text-sm text-muted-foreground mt-0.5">시황 · 차트 · AI 분석</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── 시황 Tab ─────────────────────────────────────────────────────────────── */}
      {tab === "시황" && (
        <div className="space-y-6">
          {/* MarketOverview */}
          <MarketOverview />

          {/* Popular Stocks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">국내 인기 종목</h2>
              <button
                onClick={loadPopularPrices}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                disabled={priceLoading}
              >
                <RefreshCw className={`w-3 h-3 ${priceLoading ? "animate-spin" : ""}`} />
                새로고침
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {POPULAR_KR.map(s => {
                const priceKey = `${s.ticker}.KS`;
                const price = krPrices[priceKey] ?? null;
                return (
                  <StockCard
                    key={s.ticker}
                    ticker={s.ticker}
                    name={s.name}
                    market={s.market}
                    price={price}
                    inWatchlist={isInWatchlist(s.ticker)}
                    onAddWatchlist={() => toggleWatchlist(s.ticker, s.name, s.market)}
                    onChart={() => fetchChart(toYahooTicker(s.ticker, s.market), s.name, "KRW")}
                    onAnalyze={() => openAiAnalysis(s.name)}
                  />
                );
              })}
            </div>

            <h2 className="text-sm font-semibold">해외 인기 종목</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {POPULAR_US.map(s => {
                const price = usPrices[s.ticker] ?? null;
                return (
                  <StockCard
                    key={s.ticker}
                    ticker={s.ticker}
                    name={s.name}
                    market={s.market}
                    price={price}
                    inWatchlist={isInWatchlist(s.ticker)}
                    onAddWatchlist={() => toggleWatchlist(s.ticker, s.name, s.market)}
                    onChart={() => fetchChart(toYahooTicker(s.ticker, s.market), s.name, "USD")}
                    onAnalyze={() => openAiAnalysis(s.name)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 차트 Tab ─────────────────────────────────────────────────────────────── */}
      {tab === "차트" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <div className="flex gap-2 relative">
              <div className="flex-1 relative">
                <Input
                  placeholder="종목명 또는 티커 검색 (삼성전자, AAPL ...)"
                  value={chartInputTicker}
                  onChange={e => setChartInputTicker(e.target.value)}
                  onFocus={() => chartInputTicker && setShowChartSugg(true)}
                  onBlur={() => setTimeout(() => setShowChartSugg(false), 150)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const t = chartInputTicker.trim();
                      setShowChartSugg(false);
                      fetchChart(toYahooTicker(t), t.toUpperCase(), /^\d{6}$/.test(t) ? "KRW" : "USD");
                      setChartInputTicker("");
                    }
                  }}
                />
                {showChartSugg && chartSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {chartSuggestions.map(s => (
                      <button key={s.ticker}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                        onMouseDown={() => {
                          setShowChartSugg(false);
                          setChartInputTicker("");
                          fetchChart(toYahooTicker(s.ticker, s.market), `${s.name} (${s.ticker})`, s.market === "KR" ? "KRW" : "USD");
                        }}>
                        <span className="text-xs">{s.market === "KR" ? "🇰🇷" : "🇺🇸"}</span>
                        <span className="font-medium text-sm flex-1">{s.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{s.ticker}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={() => {
                  const t = chartInputTicker.trim();
                  if (!t) return;
                  setShowChartSugg(false);
                  fetchChart(toYahooTicker(t), t.toUpperCase(), /^\d{6}$/.test(t) ? "KRW" : "USD");
                  setChartInputTicker("");
                }}
                disabled={chartLoading || !chartInputTicker.trim()}
              >
                {chartLoading && !activeTicker ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {holdings.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">보유 종목</p>
                <div className="flex flex-wrap gap-1.5">
                  {holdings.map(h => {
                    const yt = toYahooTicker(h.ticker, h.market);
                    const isActive = activeTicker?.yahoo === yt;
                    return (
                      <button key={h.id} onClick={() => fetchChart(yt, h.name, h.currency)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${isActive ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-border"}`}>
                        {h.name} <span className={isActive ? "opacity-70" : "text-muted-foreground"}>{h.ticker}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {watchlistItems.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">관심 종목</p>
                <div className="flex flex-wrap gap-1.5">
                  {watchlistItems.map(w => {
                    const yt = toYahooTicker(w.ticker, w.market);
                    const isActive = activeTicker?.yahoo === yt;
                    return (
                      <button key={w.id} onClick={() => fetchChart(yt, w.name, w.currency)}
                        className={`text-xs px-2.5 py-1 rounded-full border border-dashed transition-colors ${isActive ? "bg-primary text-primary-foreground border-primary border-solid" : "hover:bg-accent border-border"}`}>
                        {w.name} <span className={isActive ? "opacity-70" : "text-muted-foreground"}>{w.ticker}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Chart header */}
          {activeTicker && (
            <div className="space-y-3">
              {chartMeta ? (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{activeTicker.yahoo}</p>
                      <h2 className="text-lg font-bold leading-tight">{chartMeta.longName}</h2>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-bold tabular-nums">
                          {isKRW
                            ? "₩" + (lastBar?.close ?? chartMeta.regularMarketPrice ?? 0).toLocaleString("ko-KR")
                            : "$" + (lastBar?.close ?? chartMeta.regularMarketPrice ?? 0).toFixed(2)}
                        </span>
                        {lastBar && prevBar && (
                          <span className={`text-sm font-medium tabular-nums ${priceChange >= 0 ? "text-red-500" : "text-blue-500"}`}>
                            {priceChange >= 0 ? "+" : ""}{isKRW ? Math.round(priceChange).toLocaleString() : priceChange.toFixed(2)}
                            {" "}({priceChange >= 0 ? "+" : ""}{priceChangePct.toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 mt-1 shrink-0"
                      onClick={() => fetchChart(activeTicker.yahoo, activeTicker.label, activeTicker.currency)}>
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-12 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{activeTicker.label} 로딩 중...</span>
                </div>
              )}

              {/* 기간 선택 - 토스 스타일 pill */}
              <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
                {(["1W", "1M", "3M", "1Y"] as Period[]).map(p => (
                  <button key={p}
                    onClick={() => handlePeriodChange(p)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      period === p
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {p === "1W" ? "1주" : p === "1M" ? "1달" : p === "3M" ? "3달" : "1년"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chartError && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{chartError}</div>}

          {!activeTicker && (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <p className="text-4xl mb-3">📈</p>
                <p className="font-medium">종목을 선택하거나 티커를 검색하세요</p>
                <p className="text-sm text-muted-foreground mt-1">보유/관심 종목 버튼 또는 AAPL, 005930 등 직접 입력</p>
              </CardContent>
            </Card>
          )}

          {chartMeta && chartMeta.bars.length > 0 && (
            <TradingViewChart
              bars={chartMeta.bars}
              height={380}
              isKRW={isKRW}
            />
          )}
        </div>
      )}

      {/* ── AI분석 Tab ────────────────────────────────────────────────────────────── */}
      {tab === "AI분석" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="종목명 또는 티커 (삼성전자, AAPL...)"
              value={aiTicker}
              onChange={e => setAiTicker(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAiAnalyze()}
              className="flex-1"
            />
            <Button onClick={() => handleAiAnalyze()} disabled={aiLoading || !aiTicker.trim()}>
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              분석
            </Button>
          </div>

          {/* Holdings shortcuts */}
          {holdings.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">보유 종목</p>
              <div className="flex flex-wrap gap-1.5">
                {holdings.map(h => (
                  <button key={h.id} onClick={() => handleAiAnalyze(h.name)} disabled={aiLoading}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      aiAnalyzed === h.name ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-border"
                    }`}>
                    {h.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Watchlist shortcuts */}
          {watchlistItems.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">관심 종목</p>
              <div className="flex flex-wrap gap-1.5">
                {watchlistItems.map(w => (
                  <button key={w.id} onClick={() => handleAiAnalyze(w.name)} disabled={aiLoading}
                    className={`text-xs px-3 py-1.5 rounded-full border border-dashed transition-colors ${
                      aiAnalyzed === w.name ? "bg-primary text-primary-foreground border-solid border-primary" : "hover:bg-accent border-border"
                    }`}>
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cached tickers */}
          {cachedTickers.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> 이전 검색 기록
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cachedTickers.map(t => (
                  <button key={t} onClick={() => loadFromAiCache(t)} disabled={aiLoading}
                    className={`text-xs px-2.5 py-1 rounded-full border border-dashed transition-colors ${
                      aiAnalyzed === t ? "bg-muted border-solid" : "hover:bg-accent border-border text-muted-foreground"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {aiError && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{aiError}</div>}

          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Loader2 className="w-7 h-7 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium">뉴스 수집 + AI 분석 중...</p>
                <p className="text-xs mt-1 opacity-60">실시간 검색 기반 — 10~20초 소요</p>
              </div>
            </div>
          )}

          {aiSections.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-semibold text-sm">📊 {aiAnalyzed} 분석</span>
                  {aiAnalyzedAt && <span className="text-xs text-muted-foreground ml-2">{aiAnalyzedAt}</span>}
                  {aiSources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {aiSources.map(src => (
                        <span key={src} className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                          {src}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => handleAiAnalyze(aiAnalyzed, true)} disabled={aiLoading}>
                  <RefreshCw className="w-3 h-3" />새로 분석
                </Button>
              </div>
              {aiSections.filter(s => s.type === "summary").map((s, i) => <NewsSectionCard key={i} section={s} />)}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {aiSections.filter(s => s.type !== "summary").map((s, i) => <NewsSectionCard key={i} section={s} />)}
              </div>
              <p className="text-xs text-muted-foreground">⚠️ AI 분석은 참고용입니다. 투자 결정은 본인 책임입니다.</p>
            </div>
          )}

          {!aiLoading && aiSections.length === 0 && !aiError && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-4xl mb-3">📰</p>
              <p className="text-sm">종목을 입력하거나 보유/관심 종목을 클릭하세요</p>
              <p className="text-xs mt-1 opacity-60">호재·악재·단기전망·중장기전망·목표가 종합 분석</p>
            </div>
          )}
        </div>
      )}

      {/* ── 관심 종목 Tab ─────────────────────────────────────────────────────────── */}
      {tab === "관심 종목" && (
        <div className="space-y-4">
          {/* 검색 + 그룹 선택 + 새로고침 */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="종목 검색 후 추가 (삼성전자, AAPL...)"
                  value={watchlistSearchQ}
                  onChange={e => { setWatchlistSearchQ(e.target.value); setShowWatchlistSugg(true); }}
                  onBlur={() => setTimeout(() => setShowWatchlistSugg(false), 150)}
                />
                {showWatchlistSugg && watchlistSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {watchlistSuggestions.map(s => (
                      <button key={s.ticker}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted text-left"
                        onMouseDown={() => {
                          setShowWatchlistSugg(false);
                          setWatchlistSearchQ("");
                          toggleWatchlist(s.ticker, s.name, s.market, targetGroupId);
                        }}>
                        <span className="text-xs">{s.market === "KR" ? "🇰🇷" : "🇺🇸"}</span>
                        <span className="font-medium text-sm flex-1">{s.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{s.ticker}</span>
                        {isInWatchlist(s.ticker)
                          ? <Star className="w-3.5 h-3.5 text-amber-500 fill-current shrink-0" />
                          : <StarOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        }
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="outline" size="icon" onClick={loadWatchlistPrices} disabled={watchlistPriceLoading} title="가격 새로고침">
                <RefreshCw className={`w-4 h-4 ${watchlistPriceLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* 추가할 그룹 선택 */}
            {watchlistGroups.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground shrink-0">추가할 그룹:</span>
                <button
                  onClick={() => setTargetGroupId(null)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${targetGroupId === null ? "bg-foreground text-background border-foreground" : "hover:bg-muted border-border text-muted-foreground"}`}
                >
                  기타 (그룹 없음)
                </button>
                {watchlistGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setTargetGroupId(g.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${targetGroupId === g.id ? "bg-foreground text-background border-foreground" : "hover:bg-muted border-border text-muted-foreground"}`}
                  >
                    {g.emoji} {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 그룹 관리 */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              총 {watchlistItems.length}개 종목 · {watchlistGroups.length}개 그룹
            </p>
            <button
              onClick={() => setShowAddGroup(v => !v)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showAddGroup ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              그룹 추가
            </button>
          </div>

          {/* 그룹 생성 인풋 */}
          {showAddGroup && (
            <div className="flex gap-2">
              <Input
                placeholder="그룹 이름 (예: 반도체, 성장주...)"
                value={addGroupName}
                onChange={e => setAddGroupName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createGroup()}
                className="flex-1"
              />
              <Button size="sm" onClick={createGroup} disabled={addGroupLoading || !addGroupName.trim()}>
                {addGroupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "추가"}
              </Button>
            </div>
          )}

          {watchlistItems.length === 0 && watchlistGroups.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <Star className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mb-1">관심 종목이 없습니다</p>
                <p className="text-xs text-muted-foreground">위 검색창에서 종목을 추가하거나<br/>시황 탭의 ★ 버튼으로 추가하세요</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {/* 그룹별 섹션 */}
              {watchlistGroups.map(group => (
                <div key={group.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{group.emoji}</span>
                      <span className="text-sm font-semibold">{group.name}</span>
                      <span className="text-xs text-muted-foreground">({group.items.length})</span>
                    </div>
                    <button
                      onClick={() => deleteGroup(group.id, group.name)}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded"
                    >
                      삭제
                    </button>
                  </div>
                  {group.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-1">종목 없음 — 위에서 그룹을 선택 후 검색하여 추가</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.items.map(w => {
                        const yt = toYahooTicker(w.ticker, w.market);
                        const price = watchlistPrices[yt] ?? null;
                        return (
                          <WatchlistItemCard
                            key={w.id}
                            item={w}
                            price={price}
                            onChart={() => fetchChart(yt, w.name, w.market === "KR" ? "KRW" : "USD")}
                            onAnalyze={() => openAiAnalysis(w.name)}
                            onDelete={() => deleteWatchlistItem(w.id, w.name)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* 그룹 없는 항목 */}
              {watchlistUngrouped.length > 0 && (
                <div>
                  {watchlistGroups.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm">📋</span>
                      <span className="text-sm font-semibold">기타</span>
                      <span className="text-xs text-muted-foreground">({watchlistUngrouped.length})</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {watchlistUngrouped.map(w => {
                      const yt = toYahooTicker(w.ticker, w.market);
                      const price = watchlistPrices[yt] ?? null;
                      return (
                        <WatchlistItemCard
                          key={w.id}
                          item={w}
                          price={price}
                          onChart={() => fetchChart(yt, w.name, w.market === "KR" ? "KRW" : "USD")}
                          onAnalyze={() => openAiAnalysis(w.name)}
                          onDelete={() => deleteWatchlistItem(w.id, w.name)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
