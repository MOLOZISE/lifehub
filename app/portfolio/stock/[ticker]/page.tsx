"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, TrendingUp, TrendingDown, RefreshCw, Loader2,
  BarChart3, Newspaper, Info, Briefcase, Star, ExternalLink,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
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
interface ChartMeta { bars: OHLCVBar[]; currency: string; regularMarketPrice?: number; }
interface NewsResult { analysis: string; sources: string[]; }

type Period = "5D" | "1M" | "3M" | "6M" | "1Y" | "2Y";
const PERIOD_CONFIG: Record<Period, { range: string; interval: string }> = {
  "5D":  { range: "5d",  interval: "30m" },
  "1M":  { range: "1mo", interval: "1d" },
  "3M":  { range: "3mo", interval: "1d" },
  "6M":  { range: "6mo", interval: "1d" },
  "1Y":  { range: "1y",  interval: "1wk" },
  "2Y":  { range: "2y",  interval: "1wk" },
};

// ── 캔들 차트 ────────────────────────────────────────────
function calcMA(data: OHLCVBar[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0);
    return Math.round((sum / period) * 100) / 100;
  });
}

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

const CandleTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: OHLCVBar & { ma5?: number; ma20?: number } }[] }) => {
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
    </div>
  );
};

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
  strongBuy: { label: "강력매수", color: "bg-green-600" },
  buy: { label: "매수", color: "bg-green-400" },
  hold: { label: "보유", color: "bg-yellow-500" },
  underperform: { label: "매도검토", color: "bg-orange-500" },
  sell: { label: "매도", color: "bg-red-500" },
};

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
  const [maVisible, setMaVisible] = useState({ ma5: true, ma20: true, ma60: false });
  const [news, setNews] = useState<NewsResult | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [holding, setHolding] = useState<Holding | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [livePriceLoading, setLivePriceLoading] = useState(false);

  const yahooTicker = toYahooTicker(ticker, market);

  // 초기 데이터 로드
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

  async function loadChart(p: Period) {
    setChartLoading(true);
    try {
      const cfg = PERIOD_CONFIG[p];
      const res = await fetch(`/api/chart?ticker=${encodeURIComponent(yahooTicker)}&range=${cfg.range}&interval=${cfg.interval}`);
      if (res.ok) setChartMeta(await res.json());
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

  async function loadNews() {
    if (news) return; // already loaded
    setNewsLoading(true);
    try {
      const res = await fetch(`/api/ai?ticker=${encodeURIComponent(ticker)}&market=${market}&query=${encodeURIComponent(info?.name ?? ticker)}`);
      if (res.ok) setNews(await res.json());
    } catch { /* ignore */ }
    setNewsLoading(false);
  }

  function onPeriodChange(p: Period) {
    setPeriod(p);
    loadChart(p);
  }

  // 차트 데이터 가공
  const chartData = useMemo(() => {
    if (!chartMeta?.bars) return [];
    const bars = chartMeta.bars;
    const ma5 = calcMA(bars, 5);
    const ma20 = calcMA(bars, 20);
    const ma60 = calcMA(bars, 60);
    return bars.map((b, i) => ({
      ...b,
      isUp: b.close >= b.open,
      ma5: ma5[i],
      ma20: ma20[i],
      ma60: ma60[i],
    }));
  }, [chartMeta]);

  const displayPrice = livePrice ?? info?.regularMarketPrice;
  const change = info?.regularMarketChange;
  const changePct = info?.regularMarketChangePercent;
  const isUp = (change ?? 0) >= 0;
  const currency = info?.currency ?? (market === "KR" ? "KRW" : "USD");

  const priceLabel = (n: number | null | undefined) => {
    if (n == null) return "-";
    if (currency === "KRW") return `₩${n.toLocaleString("ko-KR")}`;
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  // 보유 손익 계산
  const holdingProfitRate = holding
    ? (((displayPrice ?? holding.currentPrice) - holding.avgPrice) / holding.avgPrice) * 100
    : null;
  const holdingProfitAmt = holding
    ? ((displayPrice ?? holding.currentPrice) - holding.avgPrice) * holding.quantity
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
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── 헤더 ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{info?.name ?? ticker}</h1>
            <Badge variant="outline" className="font-mono text-xs shrink-0">{ticker}</Badge>
            <Badge variant={market === "KR" ? "default" : "secondary"} className="text-xs shrink-0">
              {market === "KR" ? "🇰🇷 국내" : "🇺🇸 해외"}
            </Badge>
            {inWatchlist && <Badge className="text-xs bg-amber-500 border-0 shrink-0">⭐ 관심종목</Badge>}
          </div>
        </div>
        <Link href={`/portfolio/chart?ticker=${encodeURIComponent(yahooTicker)}`} passHref>
          <Button variant="outline" size="sm">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />차트 분석
          </Button>
        </Link>
        <Link href={`/portfolio/news?ticker=${encodeURIComponent(ticker)}&market=${market}`} passHref>
          <Button variant="outline" size="sm">
            <Newspaper className="w-3.5 h-3.5 mr-1.5" />AI 뉴스
          </Button>
        </Link>
      </div>

      {/* ── 현재가 카드 ── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground mb-1">현재가</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold tracking-tight">
                  {displayPrice != null ? priceLabel(displayPrice) : "-"}
                </span>
                {change != null && (
                  <div className={`flex items-center gap-1 text-lg font-semibold ${isUp ? "text-red-500" : "text-blue-500"}`}>
                    {isUp ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    <span>{isUp ? "+" : ""}{priceLabel(change)}</span>
                    <span className="text-base">({isUp ? "+" : ""}{((changePct ?? 0) * 100).toFixed(2)}%)</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                전일 종가 {priceLabel(info?.regularMarketPreviousClose)}
              </p>
            </div>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={refreshLivePrice} disabled={livePriceLoading}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${livePriceLoading ? "animate-spin" : ""}`} />
                실시간 갱신
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1 text-right">KIS API 필요</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">시가</p>
              <p className="font-medium text-sm">{priceLabel(info?.regularMarketOpen)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">고가</p>
              <p className="font-medium text-sm text-red-500">{priceLabel(info?.regularMarketDayHigh)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">저가</p>
              <p className="font-medium text-sm text-blue-500">{priceLabel(info?.regularMarketDayLow)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">거래량</p>
              <p className="font-medium text-sm">{fmt(info?.regularMarketVolume, 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 탭 콘텐츠 ── */}
      <Tabs defaultValue="chart">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chart"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />차트</TabsTrigger>
          <TabsTrigger value="holding"><Briefcase className="w-3.5 h-3.5 mr-1.5" />보유현황</TabsTrigger>
          <TabsTrigger value="news" onClick={loadNews}><Newspaper className="w-3.5 h-3.5 mr-1.5" />AI 뉴스</TabsTrigger>
          <TabsTrigger value="info"><Info className="w-3.5 h-3.5 mr-1.5" />기본정보</TabsTrigger>
        </TabsList>

        {/* ── 차트 탭 ── */}
        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-1">
                  {(["5D", "1M", "3M", "6M", "1Y", "2Y"] as Period[]).map(p => (
                    <button
                      key={p}
                      onClick={() => onPeriodChange(p)}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                        period === p ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 items-center">
                  <span className="text-[10px] text-muted-foreground">이평선:</span>
                  {([
                    { key: "ma5", label: "5", color: "text-purple-500 border-purple-300" },
                    { key: "ma20", label: "20", color: "text-yellow-500 border-yellow-300" },
                    { key: "ma60", label: "60", color: "text-green-500 border-green-300" },
                  ] as { key: keyof typeof maVisible; label: string; color: string }[]).map(({ key, label, color }) => (
                    <button
                      key={key}
                      onClick={() => setMaVisible(v => ({ ...v, [key]: !v[key] }))}
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition-opacity ${color} ${maVisible[key] ? "opacity-100" : "opacity-30"}`}
                    >
                      MA{label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-1 pb-4">
              {chartLoading ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 차트 로딩 중...
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  차트 데이터가 없습니다.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={d => d.slice(5)}
                      interval={Math.floor(chartData.length / 6)}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10 }}
                      tickFormatter={n => n > 1000 ? (n / 1000).toFixed(0) + "k" : String(n)}
                      width={55}
                    />
                    <Tooltip content={<CandleTooltip />} />
                    <Bar dataKey="high" shape={<CandleShape />} isAnimationActive={false}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.isUp ? "#ef4444" : "#3b82f6"} />)}
                    </Bar>
                    {maVisible.ma5 && <Line type="monotone" dataKey="ma5" stroke="#a855f7" strokeWidth={1.5} dot={false} connectNulls />}
                    {maVisible.ma20 && <Line type="monotone" dataKey="ma20" stroke="#eab308" strokeWidth={1.5} dot={false} connectNulls />}
                    {maVisible.ma60 && <Line type="monotone" dataKey="ma60" stroke="#22c55e" strokeWidth={1.5} dot={false} connectNulls />}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" />상승</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" />하락</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block" />MA5</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block" />MA20</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 보유현황 탭 ── */}
        <TabsContent value="holding" className="mt-4">
          {holding ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">내 보유현황</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">보유 수량</p>
                    <p className="text-2xl font-bold">{holding.quantity.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">주</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">평균단가</p>
                    <p className="text-2xl font-bold">{priceLabel(holding.avgPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">평가금액</p>
                    <p className="text-2xl font-bold">{priceLabel((displayPrice ?? holding.currentPrice) * holding.quantity)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">매입금액</p>
                    <p className="font-semibold">{priceLabel(holding.avgPrice * holding.quantity)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">평가손익</p>
                    <p className={`font-semibold text-lg ${(holdingProfitAmt ?? 0) >= 0 ? "text-red-500" : "text-blue-500"}`}>
                      {(holdingProfitAmt ?? 0) >= 0 ? "+" : ""}
                      {priceLabel(holdingProfitAmt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">수익률</p>
                    <p className={`font-semibold text-lg flex items-center gap-1 ${(holdingProfitRate ?? 0) >= 0 ? "text-red-500" : "text-blue-500"}`}>
                      {(holdingProfitRate ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {(holdingProfitRate ?? 0) >= 0 ? "+" : ""}
                      {(holdingProfitRate ?? 0).toFixed(2)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-2">
                <Link href="/portfolio" passHref className="flex-1">
                  <Button variant="outline" className="w-full">포트폴리오 보기</Button>
                </Link>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Briefcase className="w-10 h-10 opacity-30" />
                <p className="font-medium">보유하지 않은 종목입니다</p>
                <p className="text-sm text-center">포트폴리오에서 이 종목을 추가하면<br/>수익률을 여기서 바로 확인할 수 있습니다.</p>
                <Link href="/portfolio" passHref>
                  <Button size="sm" variant="outline">포트폴리오로 이동</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── AI 뉴스 탭 ── */}
        <TabsContent value="news" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {newsLoading ? (
                <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI가 최신 뉴스를 분석하는 중...
                </div>
              ) : news ? (
                <div className="space-y-3">
                  {news.sources.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {news.sources.map(s => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown>{news.analysis}</ReactMarkdown>
                  </div>
                  <div className="pt-2 border-t">
                    <Button size="sm" variant="outline" onClick={() => setNews(null)}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />다시 분석
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-muted-foreground gap-3">
                  <Newspaper className="w-10 h-10 opacity-30" />
                  <p>AI 뉴스 분석을 불러옵니다</p>
                  <Button onClick={loadNews} size="sm">
                    <Newspaper className="w-3.5 h-3.5 mr-1.5" />뉴스 분석 시작
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 기본정보 탭 ── */}
        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 밸류에이션 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">밸류에이션</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {[
                  ["시가총액", info?.marketCapFmt ?? (info?.marketCap != null ? fmt(info.marketCap) : "-")],
                  ["PER (주가수익비율)", info?.trailingPE != null ? fmt(info.trailingPE) + "x" : "-"],
                  ["PBR (주가순자산비율)", info?.priceToBook != null ? fmt(info.priceToBook) + "x" : "-"],
                  ["EPS (주당순이익)", priceLabel(info?.trailingEps)],
                  ["선행 EPS", priceLabel(info?.forwardEps)],
                  ["배당수익률", info?.dividendYield != null ? pct(info.dividendYield) : "-"],
                  ["베타", info?.beta != null ? fmt(info.beta) : "-"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground text-xs">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 52주 범위 + 애널리스트 */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">52주 범위</CardTitle></CardHeader>
                <CardContent>
                  {info?.fiftyTwoWeekHigh != null && info?.fiftyTwoWeekLow != null ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>저가 {priceLabel(info.fiftyTwoWeekLow)}</span>
                        <span>고가 {priceLabel(info.fiftyTwoWeekHigh)}</span>
                      </div>
                      {displayPrice != null && (
                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="absolute left-0 top-0 h-full bg-primary rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, ((displayPrice - info.fiftyTwoWeekLow) / (info.fiftyTwoWeekHigh - info.fiftyTwoWeekLow)) * 100))}%`
                            }}
                          />
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-500">저가</span>
                        {displayPrice != null && (
                          <span className="font-medium">현재 {priceLabel(displayPrice)}</span>
                        )}
                        <span className="text-red-500">고가</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">데이터 없음</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">애널리스트 의견</CardTitle></CardHeader>
                <CardContent className="space-y-2.5">
                  {info?.recommendationKey ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${RECOMMEND_LABEL[info.recommendationKey]?.color ?? "bg-gray-500"}`}>
                          {RECOMMEND_LABEL[info.recommendationKey]?.label ?? info.recommendationKey}
                        </span>
                        {info.numberOfAnalystOpinions != null && (
                          <span className="text-xs text-muted-foreground">애널리스트 {info.numberOfAnalystOpinions}명</span>
                        )}
                      </div>
                      {info.targetMeanPrice != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground text-xs">목표주가 (평균)</span>
                          <span className="font-semibold">{priceLabel(info.targetMeanPrice)}</span>
                        </div>
                      )}
                      {displayPrice != null && info.targetMeanPrice != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground text-xs">현재 대비 상승여력</span>
                          <span className={`font-semibold ${info.targetMeanPrice > displayPrice ? "text-red-500" : "text-blue-500"}`}>
                            {info.targetMeanPrice > displayPrice ? "+" : ""}
                            {(((info.targetMeanPrice - displayPrice) / displayPrice) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">데이터 없음</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 재무 지표 */}
            {(info?.revenueGrowth != null || info?.grossMargins != null) && (
              <Card className="sm:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm">재무 지표</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {info?.revenueGrowth != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">매출 성장률</p>
                      <p className={`font-semibold ${info.revenueGrowth >= 0 ? "text-red-500" : "text-blue-500"}`}>
                        {pct(info.revenueGrowth)}
                      </p>
                    </div>
                  )}
                  {info?.grossMargins != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">매출총이익률</p>
                      <p className="font-semibold">{pct(info.grossMargins)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Yahoo Finance 링크 */}
          <div className="mt-4">
            <a
              href={`https://finance.yahoo.com/quote/${encodeURIComponent(yahooTicker)}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Yahoo Finance에서 더 보기
            </a>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
