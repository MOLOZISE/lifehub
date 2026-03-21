"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TradingViewChart } from "@/components/chart/TradingViewChart";
import { toast } from "sonner";
import type { OHLCVBar } from "@/lib/types";

// ── Types ───────────────────────────────────────────────────────────────────────

interface StockPrice { price: number; change: number; changePercent: number; currency: string; name: string; }
interface AiSection { type: string; title: string; items?: string[]; text?: string; }
interface AiData { opinion?: string; risk?: string; summary?: string; sections?: AiSection[]; sources?: string[]; analyzedAt?: string; cached?: boolean; stale?: boolean; }

// ── Timeframe config ─────────────────────────────────────────────────────────────

type Timeframe = "1m" | "5m" | "15m" | "30m" | "60m" | "D" | "W" | "M";

const TIMEFRAME: Record<Timeframe, { range: string; interval: string; label: string; intraday: boolean }> = {
  "1m":  { range: "2d",  interval: "1m",  label: "1분",  intraday: true  },
  "5m":  { range: "5d",  interval: "5m",  label: "5분",  intraday: true  },
  "15m": { range: "5d",  interval: "15m", label: "15분", intraday: true  },
  "30m": { range: "1mo", interval: "30m", label: "30분", intraday: true  },
  "60m": { range: "1mo", interval: "60m", label: "60분", intraday: true  },
  "D":   { range: "3mo", interval: "1d",  label: "일",   intraday: false },
  "W":   { range: "1y",  interval: "1wk", label: "주",   intraday: false },
  "M":   { range: "5y",  interval: "1mo", label: "월",   intraday: false },
};

const OPINION_STYLE: Record<string, { bg: string; text: string }> = {
  "매수":  { bg: "bg-red-100 dark:bg-red-900/40",  text: "text-red-600 dark:text-red-400" },
  "중립":  { bg: "bg-gray-100 dark:bg-gray-800",   text: "text-gray-600 dark:text-gray-300" },
  "매도":  { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-600 dark:text-blue-400" },
};

// ── Main ─────────────────────────────────────────────────────────────────────────

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticker = decodeURIComponent(params.ticker as string);

  const [price, setPrice] = useState<StockPrice | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  const [timeframe, setTimeframe] = useState<Timeframe>("D");
  const [showIntradayMenu, setShowIntradayMenu] = useState(false);
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [chartName, setChartName] = useState(ticker);
  const [chartLoading, setChartLoading] = useState(false);

  const [ai, setAi] = useState<AiData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const isKRW = price?.currency === "KRW" || /^\d{6}/.test(ticker);

  // ── Load price ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setPriceLoading(true);
    fetch(`/api/stock/price?tickers=${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then(d => {
        const p = d.prices?.[ticker];
        if (p) setPrice(p);
      })
      .finally(() => setPriceLoading(false));
  }, [ticker]);

  // ── Load chart ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadChart(timeframe);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  async function loadChart(tf: Timeframe) {
    const { range, interval } = TIMEFRAME[tf];
    setChartLoading(true);
    try {
      const res = await fetch(`/api/chart?ticker=${encodeURIComponent(ticker)}&range=${range}&interval=${interval}`);
      const data = await res.json();
      if (data.bars) {
        setBars(data.bars);
        if (data.longName) setChartName(data.longName);
      }
    } finally {
      setChartLoading(false);
    }
  }

  function changeTimeframe(tf: Timeframe) {
    setTimeframe(tf);
    loadChart(tf);
    setShowIntradayMenu(false);
  }

  // ── Load AI analysis (cache only on mount) ──────────────────────────────────
  useEffect(() => {
    fetch(`/api/stock/ai-analysis?ticker=${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then(d => { if (d.cached) setAi(d); }); // stale도 일단 표시
  }, [ticker]);

  async function runAnalysis(force = false) {
    setAiLoading(true); setAiError("");
    try {
      const res = await fetch("/api/stock/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: chartName, ticker, force }),
      });
      const data = await res.json();
      if (data.error) { setAiError(data.error); return; }
      setAi(data);
    } catch {
      setAiError("분석 실패");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Price display ───────────────────────────────────────────────────────────
  const up = price ? price.changePercent >= 0 : null;
  const fmtPrice = price
    ? (isKRW ? `₩${Math.round(price.price).toLocaleString("ko-KR")}` : `$${price.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    : null;
  const fmtChange = price
    ? `${price.changePercent >= 0 ? "+" : ""}${price.changePercent.toFixed(2)}%`
    : null;

  // ── AI section styles ───────────────────────────────────────────────────────
  const sectionBorder: Record<string, string> = {
    positive: "border-l-green-500",
    negative: "border-l-red-500",
    neutral:  "border-l-gray-400",
    summary:  "border-l-purple-500",
  };

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-2 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-mono truncate">{ticker}</p>
          <p className="font-semibold text-sm truncate">{chartName}</p>
        </div>
        {priceLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : fmtPrice ? (
          <div className="text-right">
            <p className="font-bold">{fmtPrice}</p>
            <p className={`text-xs font-medium ${up ? "text-red-500" : "text-blue-500"}`}>{fmtChange}</p>
          </div>
        ) : null}
        <button onClick={() => loadChart(timeframe)} className="text-muted-foreground hover:text-foreground ml-1">
          <RefreshCw className={`w-4 h-4 ${chartLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-4 pt-3 space-y-4">
        {/* Timeframe selector */}
        <div className="flex items-center gap-1">
          {/* Intraday dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowIntradayMenu(v => !v)}
              onBlur={() => setTimeout(() => setShowIntradayMenu(false), 150)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                TIMEFRAME[timeframe].intraday
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground"
              }`}>
              {TIMEFRAME[timeframe].intraday ? TIMEFRAME[timeframe].label : "분봉"}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showIntradayMenu && (
              <div className="absolute top-8 left-0 z-50 bg-popover border rounded-xl shadow-lg py-1 min-w-[80px]">
                {(["1m","5m","15m","30m","60m"] as Timeframe[]).map(tf => (
                  <button key={tf} onMouseDown={() => changeTimeframe(tf)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      timeframe === tf ? "text-primary font-semibold" : "hover:bg-muted"
                    }`}>{TIMEFRAME[tf].label}</button>
                ))}
              </div>
            )}
          </div>
          {/* Daily+ buttons */}
          <div className="flex gap-0.5 bg-muted/50 rounded-xl p-1 flex-1">
            {(["D","W","M"] as Timeframe[]).map(tf => (
              <button key={tf} onClick={() => changeTimeframe(tf)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  timeframe === tf ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>{TIMEFRAME[tf].label}</button>
            ))}
          </div>
        </div>

        {/* Chart */}
        {chartLoading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 차트 로딩 중...
          </div>
        ) : bars.length > 0 ? (
          <TradingViewChart bars={bars} height={320} isKRW={isKRW}
            showMA={!TIMEFRAME[timeframe].intraday}
            intraday={TIMEFRAME[timeframe].intraday} />
        ) : (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">차트 데이터 없음</div>
        )}

        {/* Divider */}
        <div className="border-t" />

        {/* AI Analysis */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-sm">🤖 AI 분석</h2>
              {ai?.analyzedAt && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(ai.analyzedAt).toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })} 기준
                </span>
              )}
              {ai?.stale && (
                <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded-md">
                  오래된 분석
                </span>
              )}
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => runAnalysis(true)} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {aiLoading ? "분석 중..." : "새로고침"}
            </Button>
          </div>

          {aiError && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{aiError}</p>}

          {ai ? (
            <div className="space-y-2">
              {/* Opinion badge */}
              {ai.opinion && (
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${OPINION_STYLE[ai.opinion]?.bg ?? "bg-muted"}`}>
                  <span className={`text-sm font-bold ${OPINION_STYLE[ai.opinion]?.text ?? ""}`}>
                    {ai.opinion}
                  </span>
                  {ai.risk && <span className="text-xs text-muted-foreground">리스크 {ai.risk}</span>}
                  {ai.summary && <p className="text-xs flex-1 text-right opacity-80 truncate">{ai.summary}</p>}
                </div>
              )}

              {/* Sources */}
              {ai.sources && ai.sources.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ai.sources.map((s, i) => (
                    <span key={i} className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full truncate max-w-[180px]">{s}</span>
                  ))}
                </div>
              )}

              {/* Sections */}
              {ai.sections?.map((sec, i) => (
                <div key={i} className={`border-l-4 ${sectionBorder[sec.type] ?? "border-l-muted"} pl-3 py-1`}>
                  <p className="text-xs font-semibold mb-1 text-muted-foreground">{sec.title}</p>
                  {sec.items?.map((item, j) => (
                    <p key={j} className="text-xs leading-relaxed">• {item}</p>
                  ))}
                  {sec.text && <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{sec.text}</p>}
                </div>
              ))}
            </div>
          ) : !aiLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm mb-3">아직 분석된 데이터가 없어요</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => runAnalysis(false)} disabled={aiLoading}>
                <RefreshCw className="w-3.5 h-3.5" />분석 시작
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
