"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Search, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getHoldings, getWatchlist } from "@/lib/storage";
import type { OHLCVBar } from "@/lib/types";

function toYahooTicker(ticker: string, market?: "KR" | "US"): string {
  if (market === "KR" || (!market && /^\d{6}$/.test(ticker))) {
    return `${ticker}.KS`;
  }
  return ticker.toUpperCase();
}

function calcMA(data: OHLCVBar[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0);
    return Math.round((sum / period) * 100) / 100;
  });
}

type Period = "1W" | "1M" | "3M" | "1Y";
const PERIOD_RANGE: Record<Period, string> = { "1W": "5d", "1M": "1mo", "3M": "3mo", "1Y": "1y" };

const CandleShape = (props: {
  x?: number; y?: number; width?: number; height?: number;
  payload?: OHLCVBar & { isUp: boolean };
}) => {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload || height <= 0) return null;
  const { open, close, high, low, isUp } = payload;
  const range = high - low;
  if (!range) return null;
  const color = isUp ? "#ef4444" : "#3b82f6";
  const cx = x + width / 2;
  const bodyTopRatio = (high - Math.max(open, close)) / range;
  const bodyHeightRatio = Math.abs(close - open) / range;
  const bodyTopPx = y + height * bodyTopRatio;
  const bodyHeightPx = Math.max(1, height * bodyHeightRatio);
  return (
    <g>
      <line x1={cx} y1={y} x2={cx} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={x + 1} y={bodyTopPx} width={Math.max(1, width - 2)} height={bodyHeightPx} fill={color} />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: { payload: OHLCVBar & { ma5?: number; ma20?: number; ma60?: number } }[];
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const change = d.close - d.open;
  const color = change >= 0 ? "text-red-500" : "text-blue-500";
  const fmt = (n: number) => n > 1000 ? n.toLocaleString() : n.toFixed(2);
  return (
    <div className="bg-background border rounded-lg p-3 text-xs shadow-lg space-y-1">
      <p className="font-semibold">{d.date}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">시가</span><span>{fmt(d.open)}</span>
        <span className="text-muted-foreground">고가</span><span className="text-red-500">{fmt(d.high)}</span>
        <span className="text-muted-foreground">저가</span><span className="text-blue-500">{fmt(d.low)}</span>
        <span className="text-muted-foreground">종가</span><span className={color}>{fmt(d.close)}</span>
        <span className="text-muted-foreground">거래량</span><span>{d.volume?.toLocaleString()}</span>
      </div>
      {d.ma5 != null && <p className="text-purple-400">MA5: {fmt(d.ma5)}</p>}
      {d.ma20 != null && <p className="text-yellow-400">MA20: {fmt(d.ma20)}</p>}
      {d.ma60 != null && <p className="text-green-400">MA60: {fmt(d.ma60)}</p>}
    </div>
  );
};

interface ChartMeta {
  ticker: string;
  currency: string;
  regularMarketPrice?: number;
  longName: string;
  bars: OHLCVBar[];
}

export default function ChartPage() {
  const [inputTicker, setInputTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState<{ yahoo: string; label: string; currency: string } | null>(null);
  const [period, setPeriod] = useState<Period>("3M");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<ChartMeta | null>(null);
  const [holdings, setHoldings] = useState<{ id: string; name: string; ticker: string; market: "KR" | "US"; currency: string }[]>([]);
  const [watchlist, setWatchlist] = useState<{ id: string; name: string; ticker: string; market: "KR" | "US"; currency: string }[]>([]);

  useEffect(() => {
    setHoldings(getHoldings().map(h => ({ id: h.id, name: h.name, ticker: h.ticker, market: h.market, currency: h.currency })));
    setWatchlist(getWatchlist().map(w => ({ id: w.id, name: w.name, ticker: w.ticker, market: w.market, currency: w.currency })));
  }, []);

  async function fetchChart(yahooTicker: string, label: string, currency: string, p?: Period) {
    const usePeriod = p ?? period;
    setLoading(true);
    setError("");
    setMeta(null);
    setActiveTicker({ yahoo: yahooTicker, label, currency });
    try {
      const res = await fetch(`/api/chart?ticker=${encodeURIComponent(yahooTicker)}&range=${PERIOD_RANGE[usePeriod]}&interval=1d`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setMeta(data);
    } catch {
      setError("차트 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!inputTicker.trim()) return;
    const t = inputTicker.trim();
    await fetchChart(toYahooTicker(t), t.toUpperCase(), "USD");
    setInputTicker("");
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    if (activeTicker) fetchChart(activeTicker.yahoo, activeTicker.label, activeTicker.currency, p);
  }

  const bars = meta?.bars ?? [];
  const ma5 = useMemo(() => calcMA(bars, 5), [bars]);
  const ma20 = useMemo(() => calcMA(bars, 20), [bars]);
  const ma60 = useMemo(() => calcMA(bars, 60), [bars]);

  const chartData = useMemo(() => bars.map((bar, i) => ({
    ...bar,
    ma5: ma5[i],
    ma20: ma20[i],
    ma60: ma60[i],
    isUp: bar.close >= bar.open,
    candleRange: [bar.low, bar.high] as [number, number],
  })), [bars, ma5, ma20, ma60]);

  const prices = bars.flatMap(b => [b.low, b.high]);
  const minPrice = prices.length ? Math.min(...prices) * 0.998 : 0;
  const maxPrice = prices.length ? Math.max(...prices) * 1.002 : 100;

  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const priceChange = last && prev ? last.close - prev.close : 0;
  const priceChangePct = prev ? (priceChange / prev.close) * 100 : 0;
  const isKRW = meta?.currency === "KRW" || activeTicker?.currency === "KRW";

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Search */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="티커 입력 (AAPL, 005930, TSLA, 005930.KS ...)"
            value={inputTicker}
            onChange={e => setInputTicker(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading || !inputTicker.trim()}>
            {loading && !activeTicker ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
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

        {watchlist.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">관심 종목</p>
            <div className="flex flex-wrap gap-1.5">
              {watchlist.map(w => {
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

      {/* Header */}
      {activeTicker && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            {meta ? (
              <>
                <h2 className="text-xl font-bold">
                  {meta.longName}
                  <span className="text-sm font-normal text-muted-foreground ml-2">{activeTicker.yahoo}</span>
                </h2>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-2xl font-bold">
                    {isKRW
                      ? (last?.close ?? meta.regularMarketPrice ?? 0).toLocaleString("ko-KR") + "원"
                      : "$" + (last?.close ?? meta.regularMarketPrice ?? 0).toFixed(2)
                    }
                  </span>
                  {last && prev && (
                    <span className={`text-sm font-medium ${priceChange >= 0 ? "text-red-500" : "text-blue-500"}`}>
                      {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange).toFixed(isKRW ? 0 : 2)} ({Math.abs(priceChangePct).toFixed(2)}%)
                    </span>
                  )}
                  <Badge variant="outline" className="text-xs">{meta.currency}</Badge>
                </div>
              </>
            ) : (
              <div className="h-12 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{activeTicker.label} 로딩 중...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {meta && (
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => fetchChart(activeTicker.yahoo, activeTicker.label, activeTicker.currency)}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            )}
            <div className="flex gap-1">
              {(["1W", "1M", "3M", "1Y"] as Period[]).map(p => (
                <Button key={p} size="sm" variant={period === p ? "default" : "outline"}
                  className="h-7 text-xs" onClick={() => handlePeriodChange(p)}>{p}</Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {!activeTicker && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <p className="text-4xl mb-3">📈</p>
            <p className="font-medium">종목을 선택하거나 티커를 검색하세요</p>
            <p className="text-sm text-muted-foreground mt-1">보유/관심 종목 버튼 또는 AAPL, 005930 등 직접 입력</p>
          </CardContent>
        </Card>
      )}

      {meta && chartData.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }}
                      interval={Math.max(0, Math.floor(chartData.length / 6))}
                      tickFormatter={d => d.slice(5)} />
                    <YAxis domain={[minPrice, maxPrice]} tick={{ fontSize: 10 }}
                      tickFormatter={v => isKRW ? (v / 1000).toFixed(0) + "k" : v.toFixed(0)} width={48} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="candleRange" shape={CandleShape as never} isAnimationActive={false}>
                      {chartData.map((e, i) => <Cell key={i} fill={e.isUp ? "#ef4444" : "#3b82f6"} />)}
                    </Bar>
                    <Line type="monotone" dataKey="ma5" stroke="#a855f7" dot={false} strokeWidth={1} connectNulls />
                    <Line type="monotone" dataKey="ma20" stroke="#eab308" dot={false} strokeWidth={1} connectNulls />
                    <Line type="monotone" dataKey="ma60" stroke="#22c55e" dot={false} strokeWidth={1.5} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 text-xs mt-2 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400 inline-block" />MA5</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block" />MA20</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block" />MA60</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500 inline-block" />양봉</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500 inline-block" />음봉</span>
                <span className="ml-auto text-muted-foreground text-xs">{chartData.length}봉 · Yahoo Finance</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">거래량</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => (v / 1000000).toFixed(0) + "M"} width={36} />
                    <Tooltip formatter={v => typeof v === "number" ? v.toLocaleString() : String(v)} labelFormatter={l => `날짜: ${l}`} />
                    <Bar dataKey="volume" isAnimationActive={false}>
                      {chartData.map((e, i) => <Cell key={i} fill={e.isUp ? "rgba(239,68,68,0.6)" : "rgba(59,130,246,0.6)"} />)}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
