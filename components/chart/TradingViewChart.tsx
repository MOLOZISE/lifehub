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

              // Endpoint dots
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

// ── Helpers ─────────────────────────────────────────────────────────────────────

function parseTime(date: string): Time {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return Math.floor(new Date(date.replace(" ", "T") + "Z").getTime() / 1000) as UTCTimestamp;
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

// ── Props ────────────────────────────────────────────────────────────────────────

interface TradingViewChartProps {
  bars: OHLCVBar[];
  height?: number;
  isKRW?: boolean;
  showMA?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────────

export function TradingViewChart({ bars, height = 340, isKRW = false, showMA = true }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const candleRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef    = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRefs       = useRef<ISeriesApi<"Line">[]>([]);

  const [drawTool, setDrawTool] = useState<DrawTool>("none");
  const [trendP1,  setTrendP1]  = useState<TrendPoint | null>(null);
  const [hLines,   setHLines]   = useState<HLineDef[]>([]);
  const [trendLines, setTrendLines] = useState<TrendLineDef[]>([]);
  const [maVisible, setMaVisible] = useState({ ma5: true, ma20: true, ma60: false });

  // Use refs to access current state inside stable event handler closures
  const drawToolRef = useRef<DrawTool>("none");
  const trendP1Ref  = useRef<TrendPoint | null>(null);
  const isKRWRef    = useRef(isKRW);
  useEffect(() => { drawToolRef.current = drawTool; }, [drawTool]);
  useEffect(() => { trendP1Ref.current = trendP1; },  [trendP1]);
  useEffect(() => { isKRWRef.current = isKRW; }, [isKRW]);

  // ── Chart initialisation (once) ─────────────────────────────────────────────
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
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: { borderVisible: false, rightOffset: 5 },
      handleScale: true,
      handleScroll: true,
    });

    // Candlestick
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#ef4444", downColor: "#3b82f6",
      borderUpColor: "#ef4444", borderDownColor: "#3b82f6",
      wickUpColor: "#ef4444", wickDownColor: "#3b82f6",
    });

    // Volume (shared pane, bottom band)
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // MA lines
    const maColors = ["#a855f7", "#f59e0b", "#10b981"];
    const mas = maColors.map(color =>
      chart.addSeries(LineSeries, {
        color, lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
    );

    candleRef.current = candle;
    volumeRef.current = volume;
    maRefs.current    = mas;
    chartRef.current  = chart;

    // ── Click → draw ──────────────────────────────────────────────────────────
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
        const id = crypto.randomUUID();
        setHLines(prev => [...prev, { id, price, ref: priceLine }]);

      } else if (tool === "trendline") {
        const p1 = trendP1Ref.current;
        if (!p1) {
          setTrendP1({ time, price });
        } else {
          const primitive = new TrendLinePrimitive(p1, { time, price }, "#f97316");
          candle.attachPrimitive(primitive);
          const id = crypto.randomUUID();
          setTrendLines(prev => [...prev, { id, p1, p2: { time, price }, primitive }]);
          setTrendP1(null);
          setDrawTool("none");
        }
      }
    });

    // ── Resize ────────────────────────────────────────────────────────────────
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
      maRefs.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data update ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    const mas    = maRefs.current;
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

    const maPeriods = [5, 20, 60];
    maPeriods.forEach((period, i) => {
      const values = calcMA(bars, period);
      mas[i]?.setData(
        bars.flatMap((b, j) => {
          const v = values[j];
          return v !== null ? [{ time: parseTime(b.date), value: v }] : [];
        })
      );
    });

    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // ── MA visibility ────────────────────────────────────────────────────────────
  useEffect(() => {
    const [m5, m20, m60] = maRefs.current;
    m5?.applyOptions({ visible: maVisible.ma5 });
    m20?.applyOptions({ visible: maVisible.ma20 });
    m60?.applyOptions({ visible: maVisible.ma60 });
  }, [maVisible]);

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

      {/* Chart */}
      <div
        ref={containerRef}
        className={`w-full rounded-xl overflow-hidden ${drawTool !== "none" ? "cursor-crosshair" : ""}`}
        style={{ height: `${height}px` }}
      />

      {/* Drawn elements list (클릭하면 개별 삭제) */}
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
