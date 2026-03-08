"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OHLCVBar } from "@/lib/types";

// Generate 120 days of dummy OHLCV
function generateOHLCV(): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  let price = 75000;
  const start = new Date("2025-09-01");
  for (let i = 0; i < 120; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const change = (Math.random() - 0.48) * 2500;
    const open = price;
    const close = Math.max(10000, price + change);
    const high = Math.max(open, close) + Math.random() * 1000;
    const low = Math.min(open, close) - Math.random() * 1000;
    const volume = Math.floor(10000000 + Math.random() * 30000000);
    bars.push({ date: d.toISOString().slice(0, 10), open, high, low, close: Math.round(close), volume });
    price = close;
  }
  return bars;
}

const ALL_DATA = generateOHLCV();

function calcMA(data: OHLCVBar[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0);
    return Math.round(sum / period);
  });
}

type Period = "1W" | "1M" | "3M" | "1Y";

// Custom candlestick bar shape
// Recharts passes y/height for the full [low,high] range; we compute body position via ratios
const CandleShape = (props: { x?: number; y?: number; width?: number; height?: number; payload?: OHLCVBar & { isUp: boolean } }) => {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload || height <= 0) return null;
  const { open, close, high, low, isUp } = payload;
  const range = high - low;
  if (!range) return null;
  const color = isUp ? "#ef4444" : "#3b82f6";
  const cx = x + width / 2;
  // Wick: full height
  const wickTop = y;
  const wickBottom = y + height;
  // Body: ratio-based
  const bodyTopRatio = (high - Math.max(open, close)) / range;
  const bodyHeightRatio = Math.abs(close - open) / range;
  const bodyTopPx = y + height * bodyTopRatio;
  const bodyHeightPx = Math.max(1, height * bodyHeightRatio);
  return (
    <g>
      {/* Wick */}
      <line x1={cx} y1={wickTop} x2={cx} y2={wickBottom} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect x={x + 1} y={bodyTopPx} width={Math.max(1, width - 2)} height={bodyHeightPx} fill={color} />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: OHLCVBar & { ma5?: number; ma20?: number; ma60?: number } }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const change = d.close - d.open;
  const color = change >= 0 ? "text-red-500" : "text-blue-500";
  return (
    <div className="bg-background border rounded-lg p-3 text-xs shadow-lg space-y-1">
      <p className="font-semibold">{d.date}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">시가</span><span>{d.open?.toLocaleString()}</span>
        <span className="text-muted-foreground">고가</span><span className="text-red-500">{d.high?.toLocaleString()}</span>
        <span className="text-muted-foreground">저가</span><span className="text-blue-500">{d.low?.toLocaleString()}</span>
        <span className="text-muted-foreground">종가</span><span className={color}>{d.close?.toLocaleString()}</span>
        <span className="text-muted-foreground">거래량</span><span>{d.volume?.toLocaleString()}</span>
      </div>
      {d.ma5 && <p className="text-purple-400">MA5: {d.ma5.toLocaleString()}</p>}
      {d.ma20 && <p className="text-yellow-400">MA20: {d.ma20.toLocaleString()}</p>}
      {d.ma60 && <p className="text-green-400">MA60: {d.ma60.toLocaleString()}</p>}
    </div>
  );
};

export default function ChartPage() {
  const [period, setPeriod] = useState<Period>("3M");

  const sliced = useMemo(() => {
    const n = { "1W": 5, "1M": 22, "3M": 65, "1Y": ALL_DATA.length }[period];
    return ALL_DATA.slice(-n);
  }, [period]);

  const ma5 = calcMA(sliced, 5);
  const ma20 = calcMA(sliced, 20);
  const ma60 = calcMA(sliced, 60);

  const chartData = sliced.map((bar, i) => ({
    ...bar,
    ma5: ma5[i],
    ma20: ma20[i],
    ma60: ma60[i],
    isUp: bar.close >= bar.open,
    candleRange: [bar.low, bar.high] as [number, number],
  }));

  const prices = sliced.flatMap(b => [b.low, b.high]);
  const minPrice = Math.min(...prices) * 0.999;
  const maxPrice = Math.max(...prices) * 1.001;

  const last = sliced[sliced.length - 1];
  const prev = sliced[sliced.length - 2];
  const priceChange = last ? last.close - (prev?.close ?? last.open) : 0;
  const priceChangePct = prev ? (priceChange / prev.close) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">삼성전자 <span className="text-sm font-normal text-muted-foreground">005930</span></h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-2xl font-bold">{last?.close.toLocaleString()}원</span>
            <span className={`text-sm font-medium ${priceChange >= 0 ? "text-red-500" : "text-blue-500"}`}>
              {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange).toLocaleString()} ({Math.abs(priceChangePct).toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {(["1W","1M","3M","1Y"] as Period[]).map(p => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPeriod(p)}>{p}</Button>
          ))}
        </div>
      </div>

      {/* Candle Chart */}
      <Card>
        <CardContent className="p-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(sliced.length / 6)} tickFormatter={d => d.slice(5)} />
                <YAxis domain={[minPrice, maxPrice]} tick={{ fontSize: 10 }} tickFormatter={v => (v/1000).toFixed(0)+"k"} width={42} />
                <Tooltip content={<CustomTooltip />} />
                {/* Candle bars – range [low,high] so Recharts gives correct y/height to shape */}
                <Bar dataKey="candleRange" shape={CandleShape as never} isAnimationActive={false}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.isUp ? "#ef4444" : "#3b82f6"} />)}
                </Bar>
                <Line type="monotone" dataKey="ma5"  stroke="#a855f7" dot={false} strokeWidth={1} connectNulls />
                <Line type="monotone" dataKey="ma20" stroke="#eab308" dot={false} strokeWidth={1} connectNulls />
                <Line type="monotone" dataKey="ma60" stroke="#22c55e" dot={false} strokeWidth={1.5} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs mt-2">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400 inline-block" />MA5</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block" />MA20</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block" />MA60</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500 inline-block" />양봉</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500 inline-block" />음봉</span>
          </div>
        </CardContent>
      </Card>

      {/* Volume Chart */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs text-muted-foreground">거래량</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => (v/1000000).toFixed(0)+"M"} width={36} />
                <Tooltip formatter={(v) => typeof v === "number" ? v.toLocaleString() : String(v)} labelFormatter={l => `날짜: ${l}`} />
                <Bar dataKey="volume" isAnimationActive={false}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.isUp ? "rgba(239,68,68,0.6)" : "rgba(59,130,246,0.6)"} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
