"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Loader2,
  BarChart3, Newspaper, Info, Briefcase, ExternalLink, ChevronUp, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TradingViewChart } from "@/components/chart/TradingViewChart";
import type { OHLCVBar } from "@/lib/types";

// ── 타입 ────────────────────────────────────────────────
interface StockInfo {
  name: string; currency: string;
  regularMarketPrice: number | null;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  regularMarketOpen: number | null;
  regularMarketDayHigh: number | null;
  regularMarketDayLow: number | null;
  regularMarketVolume: number | null;
  regularMarketPreviousClose: number | null;
  marketCap: number | null; marketCapFmt: string | null;
  fiftyTwoWeekHigh: number | null; fiftyTwoWeekLow: number | null;
  dividendYield: number | null;
  trailingPE: number | null; priceToBook: number | null;
  trailingEps: number | null; forwardEps: number | null;
  beta: number | null;
  targetMeanPrice: number | null;
  recommendationKey: string | null;
  numberOfAnalystOpinions: number | null;
  revenueGrowth: number | null; grossMargins: number | null;
}
interface Holding {
  id: string; ticker: string; name: string; market: "KR" | "US";
  quantity: number; avgPrice: number; currentPrice: number; currency: "KRW" | "USD";
  sector: string | null;
}
interface Technicals {
  ma5: number | null; ma20: number | null; ma60: number | null;
  rsi14: number | null; macdLine: number | null; signalLine: number | null;
  bbUpper: number | null; bbMid: number | null; bbLower: number | null;
}
interface ChartMeta {
  bars: OHLCVBar[]; currency: string; regularMarketPrice?: number;
  technicals?: Technicals; techSummary?: string;
}
type SectionType = "positive" | "negative" | "neutral" | "short" | "long" | "summary";
interface NewsSection { type: SectionType; title: string; items: string[]; text?: string; }
interface NewsResult { sections: NewsSection[]; sources: string[]; }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}일 전`;
  if (h > 0) return `${h}시간 전`;
  if (m > 0) return `${m}분 전`;
  return "방금 전";
}

const SECTION_STYLES: Record<SectionType, { icon: string; border: string; bg: string }> = {
  positive: { icon: "▲", border: "border-red-200 dark:border-red-900", bg: "bg-red-50 dark:bg-red-950/30" },
  negative: { icon: "▼", border: "border-blue-200 dark:border-blue-900", bg: "bg-blue-50 dark:bg-blue-950/30" },
  neutral:  { icon: "◆", border: "border-yellow-200 dark:border-yellow-900", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
  short:    { icon: "📅", border: "border-purple-200 dark:border-purple-900", bg: "bg-purple-50 dark:bg-purple-950/30" },
  long:     { icon: "📈", border: "border-indigo-200 dark:border-indigo-900", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
  summary:  { icon: "🎯", border: "border-green-200 dark:border-green-900", bg: "bg-green-50 dark:bg-green-950/30" },
};

const OPINION_COLORS: Record<string, string> = {
  "강력매수": "bg-red-500 text-white", "매수": "bg-red-200 text-red-800",
  "중립": "bg-gray-200 text-gray-700", "매도": "bg-blue-200 text-blue-800", "강력매도": "bg-blue-500 text-white",
};

function NewsSectionCard({ section }: { section: NewsSection }) {
  const s = SECTION_STYLES[section.type] ?? SECTION_STYLES.neutral;
  const isSummary = section.type === "summary";
  const opinion = isSummary ? (section.items.find(i => i.startsWith("투자의견"))?.replace(/^투자의견:\s*/, "") ?? "") : "";
  const target = isSummary ? (section.items.find(i => i.startsWith("목표주가"))?.replace(/^목표주가:\s*/, "") ?? "") : "";
  const summary = isSummary ? (section.items.find(i => i.startsWith("한 줄"))?.replace(/^한 줄 요약:\s*/, "") ?? "") : "";
  return (
    <div className={`rounded-xl border ${s.border}`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${s.bg} rounded-t-xl`}>
        <span className="text-xs">{s.icon}</span>
        <span className="text-xs font-semibold flex-1">{section.title}</span>
        {isSummary && opinion && <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${OPINION_COLORS[opinion] ?? "bg-gray-200"}`}>{opinion}</span>}
        {isSummary && target && target !== "정보 없음" && <span className="text-xs font-medium">🎯 {target}</span>}
      </div>
      <div className="px-3 py-2">
        {isSummary && summary ? (
          <p className="text-sm font-medium">{summary}</p>
        ) : (
          <ul className="space-y-1">
            {section.items.slice(0, 4).map((item, j) => (
              <li key={j} className="text-xs flex gap-1.5 leading-relaxed">
                <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
            {section.items.length === 0 && section.text && (
              <p className="text-xs text-muted-foreground whitespace-pre-line">{section.text.split("\n").slice(0,3).join("\n")}</p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── 분봉 인터벌 (드롭다운) ───────────────────────────────────
type IntradayInterval = "1m" | "3m" | "5m" | "10m" | "15m" | "30m" | "60m" | "120m" | "240m";
const INTRADAY_OPTIONS: { label: string; value: IntradayInterval; fetchInterval: string; resample: number }[] = [
  { label: "1분",   value: "1m",   fetchInterval: "1m",  resample: 1 },
  { label: "3분",   value: "3m",   fetchInterval: "1m",  resample: 3 },
  { label: "5분",   value: "5m",   fetchInterval: "5m",  resample: 1 },
  { label: "10분",  value: "10m",  fetchInterval: "5m",  resample: 2 },
  { label: "15분",  value: "15m",  fetchInterval: "15m", resample: 1 },
  { label: "30분",  value: "30m",  fetchInterval: "30m", resample: 1 },
  { label: "60분",  value: "60m",  fetchInterval: "60m", resample: 1 },
  { label: "120분", value: "120m", fetchInterval: "60m", resample: 2 },
  { label: "240분", value: "240m", fetchInterval: "60m", resample: 4 },
];

// ── 기간 탭 ─────────────────────────────────────────────────
type Period = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";
const PERIOD_CONFIG: Record<Period, { range: string; interval: string }> = {
  "1D":  { range: "1d",  interval: "5m" },
  "1W":  { range: "5d",  interval: "30m" },
  "1M":  { range: "1mo", interval: "1d" },
  "3M":  { range: "3mo", interval: "1d" },
  "6M":  { range: "6mo", interval: "1d" },
  "1Y":  { range: "1y",  interval: "1wk" },
};
const PERIOD_LABELS: Record<Period, string> = {
  "1D": "일", "1W": "주", "1M": "월", "3M": "3M", "6M": "6M", "1Y": "년",
};

// ── OHLCV 리샘플링 (Yahoo가 지원 안하는 분봉용) ─────────────
function resampleBars(bars: OHLCVBar[], factor: number): OHLCVBar[] {
  if (factor <= 1) return bars;
  const result: OHLCVBar[] = [];
  for (let i = 0; i < bars.length; i += factor) {
    const chunk = bars.slice(i, Math.min(i + factor, bars.length));
    if (!chunk.length) continue;
    result.push({
      date:   chunk[0].date,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map(b => b.high)),
      low:    Math.min(...chunk.map(b => b.low)),
      close:  chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, b) => s + (b.volume ?? 0), 0),
    });
  }
  return result;
}


function toYahooTicker(ticker: string, market: string) {
  return market === "KR" || /^\d{6}$/.test(ticker) ? `${ticker}.KS` : ticker.toUpperCase();
}

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null) return "-";
  if (n > 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n > 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n > 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function pct(n: number | null | undefined): string {
  if (n == null) return "-";
  return `${(n * 100).toFixed(2)}%`;
}

const RECOMMEND_LABEL: Record<string, { label: string; color: string }> = {
  strongBuy: { label: "강력매수", color: "bg-red-500" },
  buy: { label: "매수", color: "bg-red-400" },
  hold: { label: "보유", color: "bg-yellow-500" },
  underperform: { label: "매도검토", color: "bg-blue-400" },
  sell: { label: "매도", color: "bg-blue-600" },
};

// 토스 스타일 지표 행
function MetricRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────
export default function StockDetailPage() {
  const params = useParams<{ ticker: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const ticker = params.ticker ?? "";
  const market = searchParams.get("market") ?? "US";

  const [info, setInfo] = useState<StockInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [chartMeta, setChartMeta] = useState<ChartMeta | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("3M");
  const [intradayInterval, setIntradayInterval] = useState<IntradayInterval>("5m");
  const [showIntradayDropdown, setShowIntradayDropdown] = useState(false);
  const [news, setNews] = useState<NewsResult | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsAnalyzedAt, setNewsAnalyzedAt] = useState<string | null>(null);
  const [holding, setHolding] = useState<Holding | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [livePriceLoading, setLivePriceLoading] = useState(false);
  const [techSummaryDismissed, setTechSummaryDismissed] = useState(false);

  const yahooTicker = toYahooTicker(ticker, market);

  useEffect(() => {
    if (!ticker) return;
    loadInfo();
    loadChart(period);
    loadHolding();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, market]);

  async function loadInfo() {
    setInfoLoading(true);
    try {
      const res = await fetch(`/api/stock/info?ticker=${encodeURIComponent(ticker)}&market=${market}`);
      if (res.ok) setInfo(await res.json());
    } catch { /* ignore */ }
    setInfoLoading(false);
  }


  async function loadChart(p: Period, iv?: IntradayInterval) {
    setChartLoading(true);
    try {
      const cfg = PERIOD_CONFIG[p];
      const useInterval = (p === "1D" || p === "1W") && iv;
      let range = cfg.range;
      let fetchInterval = cfg.interval;
      let resample = 1;

      if (useInterval) {
        const opt = INTRADAY_OPTIONS.find(o => o.value === iv)!;
        fetchInterval = opt.fetchInterval;
        resample = opt.resample;
        // 범위: 1m/3m/5m → 1d, 15m/30m → 5d, 60m이상 → 1mo
        if (["1m","3m"].includes(iv!)) range = "1d";
        else if (["5m","10m","15m","30m"].includes(iv!)) range = p === "1W" ? "5d" : "1d";
        else range = "1mo";
      }

      const res = await fetch(`/api/chart?ticker=${encodeURIComponent(yahooTicker)}&range=${range}&interval=${fetchInterval}`);
      if (res.ok) {
        const data: ChartMeta = await res.json();
        if (resample > 1 && data.bars) data.bars = resampleBars(data.bars, resample);
        setChartMeta(data);
      }
    } catch { /* ignore */ }
    setChartLoading(false);
  }

  async function loadHolding() {
    try {
      const [holdRes, watchRes] = await Promise.all([
        fetch("/api/portfolio/holdings"),
        fetch("/api/portfolio/watchlist"),
      ]);
      if (holdRes.ok) {
        const all: Holding[] = await holdRes.json();
        setHolding(all.find(h => h.ticker === ticker) ?? null);
      }
      if (watchRes.ok) {
        const data = await watchRes.json();
        const allItems: { ticker: string }[] = [
          ...(data.groups ?? []).flatMap((g: { items?: { ticker: string }[] }) => g.items ?? []),
          ...(data.ungroupedItems ?? []),
        ];
        setInWatchlist(allItems.some(w => w.ticker === ticker));
      }
    } catch { /* ignore */ }
  }

  async function refreshLivePrice() {
    setLivePriceLoading(true);
    try {
      const res = await fetch(`/api/portfolio/price?ticker=${encodeURIComponent(ticker)}&market=${market}`);
      if (res.ok) {
        const data = await res.json();
        if (data.price) setLivePrice(data.price);
        else toast.error("가격 조회 실패 (KIS API 키 확인 필요)");
      }
    } catch { /* ignore */ }
    setLivePriceLoading(false);
  }

  async function loadNews(force = false) {
    if (news && !force) return;
    setNewsLoading(true);
    setNewsError(null);
    try {
      // force가 아니면 GET으로 캐시 먼저 확인 (빠름)
      if (!force) {
        const cacheRes = await fetch(`/api/stock/ai-analysis?ticker=${encodeURIComponent(ticker)}`);
        if (cacheRes.ok) {
          const data = await cacheRes.json() as { cached: boolean; sections?: NewsSection[]; sources?: string[]; analyzedAt?: string };
          if (data.cached && data.sections?.length) {
            setNews({ sections: data.sections, sources: data.sources ?? [] });
            setNewsAnalyzedAt(data.analyzedAt ?? null);
            setNewsLoading(false);
            return;
          }
        }
      }
      // 캐시 없거나 강제 갱신 → POST로 AI 분석
      const stockName = info?.name ?? ticker;
      const res = await fetch("/api/stock/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: stockName, ticker, force }),
      });
      const data = await res.json() as { sections?: NewsSection[]; sources?: string[]; analyzedAt?: string; cached?: boolean; error?: string };
      if (res.ok && data.sections?.length) {
        setNews({ sections: data.sections, sources: data.sources ?? [] });
        setNewsAnalyzedAt(data.analyzedAt ?? null);
      } else {
        setNewsError(data.error ?? "AI 분석 요청에 실패했습니다.");
      }
    } catch (e) {
      setNewsError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    }
    setNewsLoading(false);
  }

  function onPeriodChange(p: Period) {
    setPeriod(p);
    setTechSummaryDismissed(false);
    setShowIntradayDropdown(false);
    loadChart(p, (p === "1D" || p === "1W") ? intradayInterval : undefined);
  }

  function onIntradayChange(iv: IntradayInterval) {
    setIntradayInterval(iv);
    setShowIntradayDropdown(false);
    loadChart(period, iv);
  }


  const displayPrice = livePrice ?? info?.regularMarketPrice;
  const change = info?.regularMarketChange;
  const changePct = info?.regularMarketChangePercent;
  const isUp = (change ?? 0) >= 0;
  const currency = info?.currency ?? (market === "KR" ? "KRW" : "USD");

  const priceLabel = (n: number | null | undefined, short = false) => {
    if (n == null) return "-";
    if (currency === "KRW") {
      if (short && Math.abs(n) >= 1000) return `₩${(n / 1000).toFixed(1)}K`;
      return `₩${Math.round(n).toLocaleString("ko-KR")}`;
    }
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 보유 손익 계산
  const holdingProfitRate = holding
    ? (((displayPrice ?? holding.currentPrice) - holding.avgPrice) / holding.avgPrice) * 100
    : null;
  const holdingProfitAmt = holding
    ? ((displayPrice ?? holding.currentPrice) - holding.avgPrice) * holding.quantity
    : null;

  // 52주 현재 위치 %
  const fiftyTwoPct = (displayPrice != null && info?.fiftyTwoWeekHigh != null && info?.fiftyTwoWeekLow != null)
    ? Math.min(100, Math.max(0, ((displayPrice - info.fiftyTwoWeekLow) / (info.fiftyTwoWeekHigh - info.fiftyTwoWeekLow)) * 100))
    : null;

  if (infoLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>종목 정보 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-0">

      {/* ── 헤더 ── */}
      <div className="flex items-center gap-2 py-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold truncate">{info?.name ?? ticker}</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground font-mono">{ticker}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{market === "KR" ? "국내주식" : "해외주식"}</span>
            {inWatchlist && (
              <Badge className="text-[10px] h-4 px-1.5 bg-amber-500/20 text-amber-600 border-0 ml-1">관심</Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── 현재가 블록 (토스 스타일) ── */}
      <div className="px-1 pb-6 pt-2">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold tracking-tight tabular-nums">
              {displayPrice != null ? priceLabel(displayPrice) : "—"}
            </p>
            {change != null && (
              <div className={`flex items-center gap-1.5 mt-1.5 ${isUp ? "text-red-500" : "text-blue-500"}`}>
                {isUp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span className="text-sm font-semibold">
                  {isUp ? "+" : ""}{priceLabel(change)}
                </span>
                <span className="text-sm font-medium opacity-80">
                  ({isUp ? "+" : ""}{((changePct ?? 0) * 100).toFixed(2)}%)
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              전일 종가 {priceLabel(info?.regularMarketPreviousClose)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground gap-1 h-8"
            onClick={refreshLivePrice}
            disabled={livePriceLoading}
          >
            <RefreshCw className={`w-3 h-3 ${livePriceLoading ? "animate-spin" : ""}`} />
            실시간
          </Button>
        </div>

        {/* 일일 오버뷰 */}
        <div className="grid grid-cols-4 gap-0 mt-5 bg-muted/50 rounded-2xl overflow-hidden">
          {[
            { label: "시가", value: priceLabel(info?.regularMarketOpen, true) },
            { label: "고가", value: priceLabel(info?.regularMarketDayHigh, true), cls: "text-red-500" },
            { label: "저가", value: priceLabel(info?.regularMarketDayLow, true), cls: "text-blue-500" },
            { label: "거래량", value: fmt(info?.regularMarketVolume, 0) },
          ].map(({ label, value, cls }) => (
            <div key={label} className="flex flex-col items-center py-3 px-1">
              <span className="text-[10px] text-muted-foreground mb-1">{label}</span>
              <span className={`text-xs font-semibold tabular-nums ${cls ?? ""}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 탭 ── */}
      <Tabs defaultValue="chart" onValueChange={v => { if (v === "news") loadNews(); }}>
        <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
          {[
            { value: "chart", icon: <BarChart3 className="w-3.5 h-3.5" />, label: "차트" },
            { value: "holding", icon: <Briefcase className="w-3.5 h-3.5" />, label: "보유" },
            { value: "news", icon: <Newspaper className="w-3.5 h-3.5" />, label: "AI 뉴스" },
            { value: "info", icon: <Info className="w-3.5 h-3.5" />, label: "종목정보" },
          ].map(({ value, icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 flex items-center gap-1 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 pt-1 text-xs font-medium text-muted-foreground data-[state=active]:text-foreground"
            >
              {icon}{label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── 차트 탭 ── */}
        <TabsContent value="chart" className="mt-0 space-y-0">
          {/* 기간 + 인터벌 선택 바 */}
          <div className="flex items-stretch border-b overflow-x-auto">
            {/* 분봉 드롭다운 (일/주 선택 시 표시) */}
            {(period === "1D" || period === "1W") && (
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowIntradayDropdown(v => !v)}
                  className="flex items-center gap-1 px-3 py-2.5 text-sm font-medium text-foreground border-b-2 border-foreground -mb-px h-full"
                >
                  {INTRADAY_OPTIONS.find(o => o.value === intradayInterval)?.label ?? "5분"}
                  <svg className="w-3 h-3 opacity-60" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 8L1 3h10z"/>
                  </svg>
                </button>
                {showIntradayDropdown && (
                  <div className="absolute top-full left-0 z-50 mt-1 w-24 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                    {INTRADAY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => onIntradayChange(opt.value)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted ${
                          intradayInterval === opt.value ? "font-semibold text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {opt.label}
                        {intradayInterval === opt.value && <span className="float-right text-primary">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 기간 탭 */}
            {(Object.keys(PERIOD_CONFIG) as Period[]).map(p => (
              <button key={p} onClick={() => onPeriodChange(p)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all shrink-0 ${
                  period === p
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* 드롭다운 닫기 오버레이 */}
          {showIntradayDropdown && (
            <div className="fixed inset-0 z-40" onClick={() => setShowIntradayDropdown(false)} />
          )}

          {/* 기술적 분석 요약 배너 */}
          {chartMeta?.techSummary && !techSummaryDismissed && (
            <div className="flex items-start gap-2.5 bg-muted/60 px-4 py-3">
              <span className="text-base shrink-0 mt-0.5">📊</span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-muted-foreground mr-1.5">차트 분석</span>
                <span className="text-xs text-foreground/80">{chartMeta.techSummary}</span>
              </div>
              <button onClick={() => setTechSummaryDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5 text-xs">✕</button>
            </div>
          )}

          {chartLoading ? (
            <div className="flex items-center justify-center h-72 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 차트 로딩 중...
            </div>
          ) : !chartMeta?.bars?.length ? (
            <div className="flex items-center justify-center h-72 text-muted-foreground text-sm">
              차트 데이터가 없습니다.
            </div>
          ) : (
            <TradingViewChart
              bars={chartMeta.bars}
              height={400}
              isKRW={currency === "KRW"}
            />
          )}
        </TabsContent>

        {/* ── 보유현황 탭 ── */}
        <TabsContent value="holding" className="mt-4">
          {holding ? (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-2xl p-5">
                <div className="grid grid-cols-2 gap-y-5">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">보유 수량</p>
                    <p className="text-2xl font-bold">{holding.quantity.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">주</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">평균단가</p>
                    <p className="text-2xl font-bold">{priceLabel(holding.avgPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">평가금액</p>
                    <p className="text-xl font-bold">{priceLabel((displayPrice ?? holding.currentPrice) * holding.quantity)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">매입금액</p>
                    <p className="text-xl font-bold">{priceLabel(holding.avgPrice * holding.quantity)}</p>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl p-5 ${(holdingProfitAmt ?? 0) >= 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-blue-50 dark:bg-blue-950/20"}`}>
                <p className="text-xs text-muted-foreground mb-2">평가손익</p>
                <div className="flex items-baseline gap-3">
                  <p className={`text-3xl font-bold ${(holdingProfitAmt ?? 0) >= 0 ? "text-red-500" : "text-blue-500"}`}>
                    {(holdingProfitAmt ?? 0) >= 0 ? "+" : ""}{priceLabel(holdingProfitAmt)}
                  </p>
                  <p className={`text-lg font-semibold ${(holdingProfitRate ?? 0) >= 0 ? "text-red-500" : "text-blue-500"}`}>
                    {(holdingProfitRate ?? 0) >= 0 ? "+" : ""}{(holdingProfitRate ?? 0).toFixed(2)}%
                  </p>
                </div>
              </div>

              <Link href="/portfolio" passHref>
                <Button variant="outline" className="w-full rounded-xl">포트폴리오 보기</Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <Briefcase className="w-10 h-10 opacity-30" />
              <p className="font-medium">보유하지 않은 종목입니다</p>
              <p className="text-sm text-center">포트폴리오에서 이 종목을 추가하면<br/>수익률을 여기서 바로 확인할 수 있습니다.</p>
              <Link href="/portfolio" passHref>
                <Button size="sm" variant="outline" className="rounded-xl">포트폴리오로 이동</Button>
              </Link>
            </div>
          )}
        </TabsContent>

        {/* ── AI 뉴스 탭 ── */}
        <TabsContent value="news" className="mt-4">
          {newsLoading ? (
            <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              AI가 최신 뉴스를 분석하는 중...
            </div>
          ) : newsError ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-3">
              <Newspaper className="w-10 h-10 opacity-30" />
              <p className="font-medium text-destructive">분석 실패</p>
              <p className="text-xs text-center max-w-xs break-all">{newsError}</p>
              <Button onClick={() => { setNewsError(null); loadNews(true); }} size="sm" variant="outline" className="rounded-xl">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />다시 시도
              </Button>
            </div>
          ) : news ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                {newsAnalyzedAt ? (
                  <span className="text-xs text-muted-foreground">분석: {timeAgo(newsAnalyzedAt)}</span>
                ) : <span />}
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => loadNews(true)} disabled={newsLoading}>
                  <RefreshCw className="w-3 h-3" />새로고침
                </Button>
              </div>
              {news.sources.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {news.sources.map(s => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              )}
              {news.sections.map((section, i) => (
                <NewsSectionCard key={i} section={section} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-3">
              <Newspaper className="w-10 h-10 opacity-30" />
              <p>AI가 최신 뉴스를 분석합니다</p>
              <Button onClick={() => loadNews(true)} size="sm" className="rounded-xl">
                <Newspaper className="w-3.5 h-3.5 mr-1.5" />뉴스 분석 시작
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── 종목정보 탭 ── */}
        <TabsContent value="info" className="mt-4 space-y-6">

          {/* 52주 가격 범위 */}
          {info?.fiftyTwoWeekHigh != null && info?.fiftyTwoWeekLow != null && (
            <div>
              <p className="text-sm font-semibold mb-3">52주 가격 범위</p>
              <div className="space-y-2">
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-muted-foreground/30 to-red-400 rounded-full opacity-30" />
                  {fiftyTwoPct != null && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground shadow-md border-2 border-background"
                      style={{ left: `calc(${fiftyTwoPct}% - 6px)` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-500 font-medium">{priceLabel(info.fiftyTwoWeekLow)} <span className="text-muted-foreground font-normal">저가</span></span>
                  {fiftyTwoPct != null && (
                    <span className="text-muted-foreground">현재 위치 {fiftyTwoPct.toFixed(0)}%</span>
                  )}
                  <span className="text-red-500 font-medium"><span className="text-muted-foreground font-normal">고가</span> {priceLabel(info.fiftyTwoWeekHigh)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 핵심 밸류에이션 */}
          <div>
            <p className="text-sm font-semibold mb-1">밸류에이션</p>
            <div className="divide-y">
              <MetricRow label="시가총액" value={info?.marketCapFmt ?? (info?.marketCap != null ? fmt(info.marketCap) : "-")} />
              <MetricRow label="PER" value={info?.trailingPE != null ? fmt(info.trailingPE) + "x" : "-"} />
              <MetricRow label="PBR" value={info?.priceToBook != null ? fmt(info.priceToBook) + "x" : "-"} />
              <MetricRow label="EPS" value={priceLabel(info?.trailingEps)} />
              <MetricRow label="배당수익률" value={info?.dividendYield != null ? pct(info.dividendYield) : "-"} />
              <MetricRow label="베타" value={info?.beta != null ? fmt(info.beta) : "-"} />
            </div>
          </div>

          {/* 애널리스트 의견 */}
          {info?.recommendationKey && (
            <div>
              <p className="text-sm font-semibold mb-3">애널리스트 의견</p>
              <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${RECOMMEND_LABEL[info.recommendationKey]?.color ?? "bg-gray-500"}`}>
                    {RECOMMEND_LABEL[info.recommendationKey]?.label ?? info.recommendationKey}
                  </span>
                  {info.numberOfAnalystOpinions != null && (
                    <span className="text-xs text-muted-foreground">{info.numberOfAnalystOpinions}명 참여</span>
                  )}
                </div>
                {info.targetMeanPrice != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">목표주가 (평균)</span>
                    <div className="text-right">
                      <p className="font-semibold">{priceLabel(info.targetMeanPrice)}</p>
                      {displayPrice != null && (
                        <p className={`text-xs font-medium ${info.targetMeanPrice > displayPrice ? "text-red-500" : "text-blue-500"}`}>
                          {info.targetMeanPrice > displayPrice ? "+" : ""}
                          {(((info.targetMeanPrice - displayPrice) / displayPrice) * 100).toFixed(1)}% 상승여력
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 재무 지표 */}
          {(info?.revenueGrowth != null || info?.grossMargins != null) && (
            <div>
              <p className="text-sm font-semibold mb-1">재무 지표</p>
              <div className="divide-y">
                {info?.revenueGrowth != null && (
                  <MetricRow
                    label="매출 성장률"
                    value={pct(info.revenueGrowth)}
                    valueClass={info.revenueGrowth >= 0 ? "text-red-500" : "text-blue-500"}
                  />
                )}
                {info?.grossMargins != null && (
                  <MetricRow label="매출총이익률" value={pct(info.grossMargins)} />
                )}
              </div>
            </div>
          )}

          <a
            href={`https://finance.yahoo.com/quote/${encodeURIComponent(yahooTicker)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit"
          >
            <ExternalLink className="w-3 h-3" /> Yahoo Finance에서 더 보기
          </a>
        </TabsContent>
      </Tabs>
    </div>
  );
}
