"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart, CrosshairMode, LineStyle,
  CandlestickSeries, HistogramSeries, LineSeries,
  UTCTimestamp,
} from "lightweight-charts";
import type {
  IChartApi, ISeriesApi, IPriceLine, Time,
  ISeriesPrimitive, SeriesAttachedParameter,
  IPrimitivePaneView,
} from "lightweight-charts";
import { MousePointer2, Minus, TrendingUp, Trash2 } from "lucide-react";
import type { OHLCVBar } from "@/lib/types";

// ── Types ───────────────────────────────────────────────────────────────────────

type DrawTool = "none" | "hline" | "trendline";
type Indicator = "BB" | "RSI" | "MACD";

interface TrendPoint { time: Time; price: number; }
interface HLineDef  { id: string; price: number; ref: IPriceLine; }
interface TrendLineDef {
  id: string;
  p1: TrendPoint;
  p2: TrendPoint;
  primitive: ISeriesPrimitive<Time>;
}

// ── Trend Line Primitive ────────────────────────────────────────────────────────

class TrendLinePrimitive implements ISeriesPrimitive<Time> {
  p1: TrendPoint;
  p2: TrendPoint;
  color: string;
  _att: SeriesAttachedParameter<Time> | null = null;

  constructor(p1: TrendPoint, p2: TrendPoint, color: string) {
    this.p1 = p1; this.p2 = p2; this.color = color;
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this._att = param;
    param.requestUpdate();
  }
  detached() { this._att = null; }
  updateAllViews() {}

  paneViews(): IPrimitivePaneView[] {
    const att = this._att;
    if (!att) return [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return [{
      zOrder: (() => "top") as () => "top",
      renderer() {
        return {
          draw(target: { useMediaCoordinateSpace: (cb: (s: { context: CanvasRenderingContext2D }) => void) => void }) {
            target.useMediaCoordinateSpace(({ context }) => {
              const x1 = att.chart.timeScale().timeToCoordinate(self.p1.time);
              const y1 = att.series.priceToCoordinate(self.p1.price);
              const x2 = att.chart.timeScale().timeToCoordinate(self.p2.time);
              const y2 = att.series.priceToCoordinate(self.p2.price);
              if (x1 === null || y1 === null || x2 === null || y2 === null) return;

              context.save();
              context.beginPath();
              context.moveTo(x1, y1);
              context.lineTo(x2, y2);
              context.strokeStyle = self.color;
              context.lineWidth = 1.5;
              context.stroke();

              for (const [px, py] of [[x1, y1], [x2, y2]] as [number, number][]) {
                context.beginPath();
                context.arc(px, py, 3, 0, Math.PI * 2);
                context.fillStyle = self.color;
                context.fill();
              }
              context.restore();
            });
          },
        };
      },
    }];
  }
}

// ── Indicator math ──────────────────────────────────────────────────────────────

function calcSMA(vals: number[], period: number): (number | null)[] {
  return vals.map((_, i) => {
    if (i < period - 1) return null;
    return vals.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(vals: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = vals.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < vals.length; i++) {
    if (i < period - 1) { result.push(vals[i]); continue; }
    if (i === period - 1) { result.push(ema); continue; }
    ema = vals[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcBB(closes: number[], period = 20, mult = 2) {
  const mid = calcSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  closes.forEach((_, i) => {
    if (mid[i] == null) { upper.push(null); lower.push(null); return; }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i]!;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    upper.push(mean + mult * std);
    lower.push(mean - mult * std);
  });
  return { upper, mid, lower };
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss += Math.abs(d);
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? Math.abs(d) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  const fastEMA = calcEMA(closes, fast);
  const slowEMA = calcEMA(closes, slow);
  const macd = fastEMA.map((v, i) => (i >= slow - 1 ? v - slowEMA[i] : null));
  const macdFilled = macd.map(v => v ?? 0);
  const signalLine = calcEMA(macdFilled, signal);
  const histogram = macd.map((v, i) => (v != null && i >= slow - 1 ? v - signalLine[i] : null));
  return { macd, signal: signalLine, histogram };
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function parseTime(date: string): Time {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const normalized = date.endsWith("Z") ? date : date.replace(" ", "T") + "Z";
  return Math.floor(new Date(normalized).getTime() / 1000) as UTCTimestamp;
}

function calcMA(bars: OHLCVBar[], period: number): (number | null)[] {
  return bars.map((_, i) => {
    if (i < period - 1) return null;
    const sum = bars.slice(i - period + 1, i + 1).reduce((s, b) => s + b.close, 0);
    return Math.round((sum / period) * 10000) / 10000;
  });
}

function isDark() {
  return document.documentElement.classList.contains("dark");
}

function makeSubChart(el: HTMLDivElement, height: number, dark: boolean) {
  return createChart(el, {
    width: el.clientWidth,
    height,
    layout: {
      background: { color: "transparent" },
      textColor: dark ? "#9ca3af" : "#6b7280",
    },
    grid: {
      vertLines: { color: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
      horzLines: { color: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: { borderVisible: false, rightOffset: 5, visible: false },
    handleScale: true,
    handleScroll: true,
  });
}

// ── Props ────────────────────────────────────────────────────────────────────────

interface TradingViewChartProps {
  bars: OHLCVBar[];
  height?: number;
  isKRW?: boolean;
  showMA?: boolean;
  intraday?: boolean;  // 분봉 여부
}

const SUB_HEIGHT = 100;

// ── Component ────────────────────────────────────────────────────────────────────

export function TradingViewChart({ bars, height = 340, isKRW = false, showMA = true, intraday = false }: TradingViewChartProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const subRef        = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const subChartRef   = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef     = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRefs        = useRef<ISeriesApi<"Line">[]>([]);
  const bbRefs        = useRef<ISeriesApi<"Line">[]>([]);

  const [drawTool, setDrawTool] = useState<DrawTool>("none");
  const [trendP1,  setTrendP1]  = useState<TrendPoint | null>(null);
  const [hLines,   setHLines]   = useState<HLineDef[]>([]);
  const [trendLines, setTrendLines] = useState<TrendLineDef[]>([]);
  const [maVisible, setMaVisible] = useState({ ma5: true, ma20: true, ma60: false });
  const [activeInd, setActiveInd] = useState<Indicator | null>(null);
  const [bbVisible, setBbVisible] = useState(false);

  const drawToolRef = useRef<DrawTool>("none");
  const trendP1Ref  = useRef<TrendPoint | null>(null);
  const isKRWRef    = useRef(isKRW);
  useEffect(() => { drawToolRef.current = drawTool; }, [drawTool]);
  useEffect(() => { trendP1Ref.current = trendP1; },  [trendP1]);
  useEffect(() => { isKRWRef.current = isKRW; }, [isKRW]);

  // ── Main chart init ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dark = isDark();

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: dark ? "#9ca3af" : "#6b7280",
      },
      grid: {
        vertLines: { color: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
        horzLines: { color: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: {
        borderVisible: false,
        rightOffset: 5,
        timeVisible: intraday,
        secondsVisible: false,
      },
      localization: {
        timeFormatter: (t: number | { year: number; month: number; day: number }) => {
          if (typeof t === "object") {
            // BusinessDay (일봉/주봉/월봉)
            return `${t.year}년 ${t.month}월 ${t.day}일`;
          }
          // UTCTimestamp (분봉)
          const d = new Date(t * 1000);
          return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
        },
      },
      handleScale: true,
      handleScroll: true,
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#ef4444", downColor: "#3b82f6",
      borderUpColor: "#ef4444", borderDownColor: "#3b82f6",
      wickUpColor: "#ef4444", wickDownColor: "#3b82f6",
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const maColors = ["#a855f7", "#f59e0b", "#10b981"];
    const mas = maColors.map(color =>
      chart.addSeries(LineSeries, {
        color, lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
    );

    // BB lines: upper, mid, lower
    const bbColors = ["#60a5fa", "#93c5fd", "#60a5fa"];
    const bbs = bbColors.map(color =>
      chart.addSeries(LineSeries, {
        color, lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        visible: false,
      })
    );

    candleRef.current = candle;
    volumeRef.current = volume;
    maRefs.current    = mas;
    bbRefs.current    = bbs;
    chartRef.current  = chart;

    chart.subscribeClick(param => {
      if (!param.time || !param.point) return;
      const price = candle.coordinateToPrice(param.point.y);
      if (price === null) return;
      const tool = drawToolRef.current;
      const time  = param.time as Time;
      if (tool === "hline") {
        const label = isKRWRef.current
          ? Math.round(price).toLocaleString("ko-KR")
          : price.toFixed(2);
        const priceLine = candle.createPriceLine({
          price, color: "#f97316", lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true, title: label,
        });
        setHLines(prev => [...prev, { id: crypto.randomUUID(), price, ref: priceLine }]);
      } else if (tool === "trendline") {
        const p1 = trendP1Ref.current;
        if (!p1) {
          setTrendP1({ time, price });
        } else {
          const primitive = new TrendLinePrimitive(p1, { time, price }, "#f97316");
          candle.attachPrimitive(primitive);
          setTrendLines(prev => [...prev, { id: crypto.randomUUID(), p1, p2: { time, price }, primitive }]);
          setTrendP1(null);
          setDrawTool("none");
        }
      }
    });

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.resize(entry.contentRect.width, height);
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = candleRef.current = volumeRef.current = null;
      maRefs.current = []; bbRefs.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data update ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    const mas    = maRefs.current;
    const bbs    = bbRefs.current;
    if (!candle || !volume || bars.length === 0) return;

    candle.setData(bars.map(b => ({
      time: parseTime(b.date),
      open: b.open, high: b.high, low: b.low, close: b.close,
    })));

    volume.setData(bars.map(b => ({
      time: parseTime(b.date),
      value: b.volume ?? 0,
      color: b.close >= b.open ? "rgba(239,68,68,0.35)" : "rgba(59,130,246,0.35)",
    })));

    const closes = bars.map(b => b.close);
    const times  = bars.map(b => parseTime(b.date));

    // MA
    const maPeriods = [5, 20, 60];
    maPeriods.forEach((period, i) => {
      const values = calcMA(bars, period);
      mas[i]?.setData(bars.flatMap((b, j) => {
        const v = values[j];
        return v !== null ? [{ time: parseTime(b.date), value: v }] : [];
      }));
    });

    // BB
    const { upper, mid, lower } = calcBB(closes);
    [upper, mid, lower].forEach((vals, i) => {
      bbs[i]?.setData(
        vals.flatMap((v, j) => v != null ? [{ time: times[j], value: v }] : [])
      );
    });

    chartRef.current?.timeScale().fitContent();

    // sub chart data update if visible
    updateSubChart(bars);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars]);

  // ── MA visibility ────────────────────────────────────────────────────────────
  useEffect(() => {
    const [m5, m20, m60] = maRefs.current;
    m5?.applyOptions({ visible: maVisible.ma5 });
    m20?.applyOptions({ visible: maVisible.ma20 });
    m60?.applyOptions({ visible: maVisible.ma60 });
  }, [maVisible]);

  // ── BB visibility ────────────────────────────────────────────────────────────
  useEffect(() => {
    bbRefs.current.forEach(s => s?.applyOptions({ visible: bbVisible }));
  }, [bbVisible]);

  // ── Sub chart (RSI / MACD) ──────────────────────────────────────────────────
  useEffect(() => {
    const el = subRef.current;
    // Destroy old sub chart first
    if (subChartRef.current) {
      subChartRef.current.remove();
      subChartRef.current = null;
    }
    if (!el || !activeInd) return;
    const dark = isDark();
    const sub = makeSubChart(el, SUB_HEIGHT, dark);
    subChartRef.current = sub;

    // Sync time scale with main chart
    const main = chartRef.current;
    if (main) {
      main.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) sub.timeScale().setVisibleLogicalRange(range);
      });
      sub.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) main.timeScale().setVisibleLogicalRange(range);
      });
    }

    updateSubChart(bars);

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) sub.resize(entry.contentRect.width, SUB_HEIGHT);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      sub.remove();
      subChartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInd]);

  function updateSubChart(b: OHLCVBar[]) {
    const sub = subChartRef.current;
    if (!sub || !activeInd || b.length === 0) return;
    const closes = b.map(x => x.close);
    const times  = b.map(x => parseTime(x.date));

    if (activeInd === "RSI") {
      const rsi = calcRSI(closes);
      // 70 / 30 levels
      const rsiSeries = sub.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1 as never, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
      rsiSeries.setData(rsi.flatMap((v, i) => v != null ? [{ time: times[i], value: v }] : []));
      sub.priceScale("right").applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });
      // overbought / oversold lines
      const ob = rsiSeries.createPriceLine({ price: 70, color: "#ef4444", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "70" });
      const os = rsiSeries.createPriceLine({ price: 30, color: "#3b82f6", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: "30" });
      void ob; void os;

    } else if (activeInd === "MACD") {
      const { macd, signal, histogram } = calcMACD(closes);
      const slow = 26;
      const histSeries = sub.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
      histSeries.setData(histogram.flatMap((v, i) => v != null ? [{ time: times[i], value: v, color: v >= 0 ? "rgba(239,68,68,0.6)" : "rgba(59,130,246,0.6)" }] : []));
      const macdSeries   = sub.addSeries(LineSeries, { color: "#a855f7", lineWidth: 1 as never, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      const signalSeries = sub.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1,   priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      macdSeries.setData(macd.flatMap((v, i) => v != null && i >= slow - 1 ? [{ time: times[i], value: v }] : []));
      signalSeries.setData(signal.flatMap((v, i) => i >= slow + 8 ? [{ time: times[i], value: v }] : []));
    }

    sub.timeScale().fitContent();
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  function removeHLine(id: string) {
    const candle = candleRef.current;
    const hl = hLines.find(h => h.id === id);
    if (hl && candle) candle.removePriceLine(hl.ref);
    setHLines(prev => prev.filter(h => h.id !== id));
  }

  function removeTrendLine(id: string) {
    const candle = candleRef.current;
    const tl = trendLines.find(t => t.id === id);
    if (tl && candle) candle.detachPrimitive(tl.primitive);
    setTrendLines(prev => prev.filter(t => t.id !== id));
  }

  function clearAll() {
    const candle = candleRef.current;
    if (!candle) return;
    hLines.forEach(hl => candle.removePriceLine(hl.ref));
    trendLines.forEach(tl => candle.detachPrimitive(tl.primitive));
    setHLines([]); setTrendLines([]); setTrendP1(null); setDrawTool("none");
  }

  function toggleIndicator(ind: Indicator) {
    if (ind === "BB") {
      setBbVisible(v => !v);
    } else {
      setActiveInd(prev => prev === ind ? null : ind);
    }
  }

  const totalDrawings = hLines.length + trendLines.length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Draw tools */}
        <div className="flex gap-0.5 bg-muted/50 rounded-xl p-1">
          {([
            { tool: "none"      as DrawTool, icon: <MousePointer2 className="w-3.5 h-3.5" />, label: "선택" },
            { tool: "hline"     as DrawTool, icon: <Minus className="w-3.5 h-3.5" />,         label: "수평선" },
            { tool: "trendline" as DrawTool, icon: <TrendingUp className="w-3.5 h-3.5" />,    label: "추세선" },
          ]).map(({ tool, icon, label }) => (
            <button
              key={tool}
              onClick={() => { setDrawTool(tool); setTrendP1(null); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                drawTool === tool
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* MA toggles */}
        {showMA && (
          <div className="flex gap-1">
            {([
              { key: "ma5"  as const, label: "5일",  color: "text-purple-500", bg: "bg-purple-500/15" },
              { key: "ma20" as const, label: "20일", color: "text-amber-500",  bg: "bg-amber-500/15"  },
              { key: "ma60" as const, label: "60일", color: "text-emerald-500",bg: "bg-emerald-500/15"},
            ]).map(({ key, label, color, bg }) => (
              <button key={key}
                onClick={() => setMaVisible(v => ({ ...v, [key]: !v[key] }))}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${color} ${maVisible[key] ? bg : "opacity-30"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Indicator toggles */}
        <div className="flex gap-1">
          {(["BB", "RSI", "MACD"] as Indicator[]).map(ind => {
            const active = ind === "BB" ? bbVisible : activeInd === ind;
            return (
              <button key={ind}
                onClick={() => toggleIndicator(ind)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                  active ? "bg-sky-500/15 text-sky-500" : "text-muted-foreground opacity-50 hover:opacity-80"
                }`}
              >
                {ind}
              </button>
            );
          })}
        </div>

        {/* Drawing status */}
        {drawTool !== "none" && (
          <span className="text-[10px] text-orange-500 font-medium ml-1">
            {drawTool === "hline"
              ? "클릭 → 수평선 추가"
              : trendP1 ? "두 번째 점 클릭" : "시작점 클릭"}
          </span>
        )}

        {/* Clear */}
        {totalDrawings > 0 && (
          <button onClick={clearAll}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
          >
            <Trash2 className="w-3 h-3" />
            초기화 ({totalDrawings})
          </button>
        )}
      </div>

      {/* Main chart */}
      <div
        ref={containerRef}
        className={`w-full rounded-xl overflow-hidden ${drawTool !== "none" ? "cursor-crosshair" : ""}`}
        style={{ height: `${height}px` }}
      />

      {/* Sub chart (RSI / MACD) */}
      {activeInd && (
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground px-1 font-medium">
            {activeInd === "RSI" ? "RSI (14)" : "MACD (12, 26, 9)"}
          </p>
          <div ref={subRef} className="w-full rounded-xl overflow-hidden" style={{ height: `${SUB_HEIGHT}px` }} />
        </div>
      )}

      {/* Drawn elements list */}
      {totalDrawings > 0 && (
        <div className="flex flex-wrap gap-1">
          {hLines.map(hl => (
            <button key={hl.id} onClick={() => removeHLine(hl.id)}
              className="flex items-center gap-1 text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              ─ {isKRW ? Math.round(hl.price).toLocaleString("ko-KR") : hl.price.toFixed(2)} ×
            </button>
          ))}
          {trendLines.map((tl, i) => (
            <button key={tl.id} onClick={() => removeTrendLine(tl.id)}
              className="flex items-center gap-1 text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              ↗ 추세선 {i + 1} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
