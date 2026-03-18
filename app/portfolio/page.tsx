"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyzePortfolioRisk } from "@/lib/recommendation";
import { getProfitColor, formatCurrency } from "@/lib/utils-app";
import { toast } from "sonner";
import type { PortfolioSector } from "@/lib/types";

interface Holding {
  id: string; ticker: string; name: string; market: "KR" | "US";
  sector: PortfolioSector | null; quantity: number; avgPrice: number;
  currentPrice: number; currency: "KRW" | "USD"; memo?: string;
}

const CHART_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];

const SECTOR_LABELS: Record<PortfolioSector, string> = {
  tech: "IT/기술",
  semiconductor: "반도체",
  finance: "금융",
  healthcare: "헬스케어",
  energy: "에너지",
  consumer: "소비재",
  industrial: "산업재",
  materials: "소재",
  real_estate: "부동산",
  utilities: "유틸리티",
  communication: "통신",
  etf: "ETF",
  other: "기타",
};

const RISK_COLORS = {
  low: "text-green-600 bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800",
  medium: "text-amber-600 bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800",
  high: "text-red-600 bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800",
};

const KRW_TO_USD = 1350;

function toUSD(h: Holding): number {
  const val = h.quantity * h.currentPrice;
  return h.currency === "KRW" ? val / KRW_TO_USD : val;
}

function profitRate(h: Holding): number {
  return ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
}

function profitAmount(h: Holding): number {
  return (h.currentPrice - h.avgPrice) * h.quantity;
}

const emptyHolding = {
  ticker: "", name: "", market: "KR", sector: "other" as PortfolioSector,
  quantity: 0, avgPrice: 0, currentPrice: 0, currency: "KRW", memo: "",
};

interface StockMeta { ticker: string; name: string; market: "KR" | "US"; sector: string; }

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [form, setForm] = useState(emptyHolding);
  // 자동완성
  const [searchQ, setSearchQ] = useState("");
  const [suggestions, setSuggestions] = useState<StockMeta[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const suggRef = useRef<HTMLDivElement>(null);

  async function loadHoldings() {
    try {
      const res = await fetch("/api/portfolio/holdings");
      if (res.ok) setHoldings(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadHoldings(); }, []);

  // 3분마다 자동 갱신 (장중에만 의미 있지만 항상 실행)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshPricesSilent();
    }, 3 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalUSD = holdings.reduce((s, h) => s + toUSD(h), 0);
  const totalCostUSD = holdings.reduce((s, h) => {
    const cost = h.quantity * h.avgPrice;
    return s + (h.currency === "KRW" ? cost / KRW_TO_USD : cost);
  }, 0);
  const totalProfitUSD = totalUSD - totalCostUSD;
  const totalProfitRate = totalCostUSD > 0 ? (totalProfitUSD / totalCostUSD) * 100 : 0;

  const risk = analyzePortfolioRisk(holdings as unknown as import("@/lib/types").Holding[]);

  const chartData = holdings.map(h => ({
    name: h.name,
    value: Math.round((toUSD(h) / totalUSD) * 100),
  }));

  // Sector chart data
  const sectorData: { name: string; value: number }[] = [];
  const sectorMap: Record<string, number> = {};
  holdings.forEach(h => {
    const label = SECTOR_LABELS[h.sector ?? "other"];
    sectorMap[label] = (sectorMap[label] ?? 0) + Math.round(toUSD(h) / totalUSD * 100);
  });
  Object.entries(sectorMap).forEach(([name, value]) => sectorData.push({ name, value }));

  // 자동완성 검색
  useEffect(() => {
    if (!dialogOpen || editing) return;
    const t = setTimeout(() => {
      fetch(`/api/portfolio/search?q=${encodeURIComponent(searchQ)}`)
        .then(r => r.json()).then(d => { setSuggestions(d); setShowSugg(true); });
    }, 150);
    return () => clearTimeout(t);
  }, [searchQ, dialogOpen, editing]);

  async function selectStock(s: StockMeta) {
    setShowSugg(false);
    setSearchQ(s.name);
    setForm(f => ({ ...f, ticker: s.ticker, name: s.name, market: s.market, sector: s.sector as PortfolioSector, currency: s.market === "KR" ? "KRW" : "USD" }));
    setFetchingPrice(true);
    try {
      const res = await fetch(`/api/portfolio/price?ticker=${s.ticker}&market=${s.market}`);
      if (res.ok) {
        const data = await res.json();
        if (data.price) setForm(f => ({ ...f, currentPrice: data.price, avgPrice: f.avgPrice || data.price }));
      }
    } finally { setFetchingPrice(false); }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyHolding);
    setSearchQ("");
    setSuggestions([]);
    // 인기 종목 로드
    fetch("/api/portfolio/search?q=").then(r => r.json()).then(d => { setSuggestions(d); setShowSugg(true); });
    setDialogOpen(true);
  }

  function openEdit(h: Holding) {
    setEditing(h);
    setForm({
      ticker: h.ticker, name: h.name, market: h.market,
      sector: h.sector ?? "other",
      quantity: h.quantity, avgPrice: h.avgPrice,
      currentPrice: h.currentPrice, currency: h.currency,
      memo: h.memo ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.ticker || !form.name) return;
    const payload = { ...form };
    if (editing) {
      const res = await fetch(`/api/portfolio/holdings/${editing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error("저장 실패"); return; }
    } else {
      const res = await fetch("/api/portfolio/holdings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error("저장 실패"); return; }
    }
    setDialogOpen(false);
    loadHoldings();
  }

  async function refreshPrices(silent = false): Promise<void> {
    // 현재 holdings를 직접 fetch해서 최신 상태 사용 (stale closure 방지)
    let currentHoldings = holdings;
    if (currentHoldings.length === 0) {
      try {
        const r = await fetch("/api/portfolio/holdings");
        if (r.ok) currentHoldings = await r.json();
      } catch { return; }
    }
    if (currentHoldings.length === 0) return;

    if (!silent) setRefreshing(true);
    try {
      const tickers = currentHoldings.map(h => h.ticker).join(",");
      const markets = currentHoldings.map(h => h.market).join(",");
      const res = await fetch(`/api/portfolio/price?tickers=${tickers}&markets=${markets}`);
      if (!res.ok) {
        if (!silent) toast.error("가격 조회 실패 (KIS API 확인 필요)");
        return;
      }
      const prices = await res.json() as Record<string, { price: number; error?: string }>;

      let updated = 0;
      await Promise.all(currentHoldings.map(async h => {
        const data = prices[h.ticker];
        if (!data || data.error || !data.price || data.price === h.currentPrice) return;
        try {
          await fetch(`/api/portfolio/holdings/${h.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPrice: data.price }),
          });
          updated++;
        } catch { /* individual update failure is ok */ }
      }));

      await loadHoldings();
      if (!silent) {
        toast.success(updated > 0 ? `${updated}개 종목 현재가 갱신 완료` : "변동된 가격이 없습니다");
      }
    } catch (e) {
      if (!silent) toast.error(`갱신 실패: ${e instanceof Error ? e.message : "오류"}`);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  function refreshPricesSilent() { refreshPrices(true); }
  function handleRefreshPrices() { refreshPrices(false); }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/portfolio/holdings/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    setHoldings(h => h.filter(x => x.id !== id));
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">총 평가금액 (USD)</p>
            <p className="text-2xl font-bold">${totalUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">총 손익</p>
            <p className={`text-2xl font-bold ${getProfitColor(totalProfitUSD)}`}>
              {totalProfitUSD >= 0 ? "+" : ""}${totalProfitUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">총 수익률</p>
            <p className={`text-2xl font-bold flex items-center gap-1 ${getProfitColor(totalProfitRate)}`}>
              {totalProfitRate >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {totalProfitRate >= 0 ? "+" : ""}{totalProfitRate.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Analysis */}
      <Card className={`border ${RISK_COLORS[risk.riskLevel]}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {risk.riskLevel === "low"
                ? <ShieldCheck className="w-4 h-4 text-green-600" />
                : <AlertTriangle className="w-4 h-4 text-amber-600" />
              }
              <span className="text-sm font-semibold">
                포트폴리오 리스크 — {risk.riskLevel === "low" ? "낮음" : risk.riskLevel === "medium" ? "보통" : "높음"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">분산도</span>
              <span className="font-bold">{risk.diversificationScore}/100</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">최대 단일 종목</p>
              <p className="font-bold text-sm">{risk.topHoldingConcentration.toFixed(0)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">최대 섹터</p>
              <p className="font-bold text-sm">{risk.sectorConcentration.toFixed(0)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">국내/해외</p>
              <p className="font-bold text-sm">{risk.marketConcentration.KR}/{risk.marketConcentration.US}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">보유 종목</p>
              <p className="font-bold text-sm">{holdings.length}개</p>
            </div>
          </div>

          {risk.warnings.length > 0 && (
            <div className="space-y-1">
              {risk.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {risk.warnings.length === 0 && (
            <p className="text-xs text-green-700 dark:text-green-400">포트폴리오가 잘 분산되어 있습니다.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart - Holdings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">종목별 비중</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Holdings table */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm">보유 종목</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleRefreshPrices} disabled={refreshing || holdings.length === 0}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />현재가 갱신
              </Button>
              <Button size="sm" onClick={openAdd}><Plus className="w-3.5 h-3.5 mr-1" />종목 추가</Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">종목</th>
                  <th className="px-3 py-2 text-right">수량</th>
                  <th className="px-3 py-2 text-right">평균단가</th>
                  <th className="px-3 py-2 text-right">현재가</th>
                  <th className="px-3 py-2 text-right">수익률</th>
                  <th className="px-3 py-2 text-right">평가손익</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const rate = profitRate(h);
                  const profit = profitAmount(h);
                  const color = getProfitColor(rate);
                  return (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <div>
                          <span className="font-medium">{h.name}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">{h.ticker}</span>
                        </div>
                        <div className="flex gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4">{h.market}</Badge>
                          {h.sector && (
                            <Badge variant="outline" className="text-[10px] h-4">{SECTOR_LABELS[h.sector]}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">{h.quantity.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(h.avgPrice, h.currency)}</td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(h.currentPrice, h.currency)}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${color}`}>
                        {rate >= 0 ? "+" : ""}{rate.toFixed(2)}%
                      </td>
                      <td className={`px-3 py-2.5 text-right ${color}`}>
                        {profit >= 0 ? "+" : ""}{formatCurrency(profit, h.currency)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(h)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(h.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sector breakdown */}
      {sectorData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">섹터별 비중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sectorData.sort((a, b) => b.value - a.value).map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span>{item.name}</span>
                  <span className="font-bold">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "종목 수정" : "종목 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* 자동완성 검색 (추가 시에만) */}
            {!editing && (
              <div ref={suggRef} className="relative">
                <p className="text-xs mb-1 font-medium">종목 검색 *</p>
                <Input
                  value={searchQ}
                  onChange={e => { setSearchQ(e.target.value); setShowSugg(true); }}
                  onFocus={() => setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                  placeholder="종목명 또는 티커 (예: 삼성, AAPL)"
                  autoFocus
                />
                {showSugg && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {!searchQ && <p className="px-3 py-1.5 text-xs text-muted-foreground border-b">인기 종목 TOP 50</p>}
                    {suggestions.map(s => (
                      <button key={s.ticker} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                        onMouseDown={() => selectStock(s)}>
                        <span className="text-xs">{s.market === "KR" ? "🇰🇷" : "🇺🇸"}</span>
                        <span className="font-medium text-sm flex-1">{s.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{s.ticker}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* 선택된 종목 */}
            {form.ticker && (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                <span>{form.market === "KR" ? "🇰🇷" : "🇺🇸"}</span>
                <span className="font-medium">{form.name}</span>
                <span className="text-muted-foreground font-mono text-xs">{form.ticker}</span>
                {fetchingPrice && <span className="ml-auto text-xs text-muted-foreground">가격 조회 중...</span>}
                {form.currentPrice > 0 && !fetchingPrice && (
                  <span className="ml-auto text-xs font-semibold text-green-600">
                    {form.currency === "KRW" ? `₩${form.currentPrice.toLocaleString()}` : `$${form.currentPrice.toLocaleString()}`}
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1">섹터</p>
                <Select value={form.sector ?? "other"} onValueChange={v => setForm(f => ({ ...f, sector: v as PortfolioSector }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SECTOR_LABELS) as [PortfolioSector, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs mb-1">수량</p>
                <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-xs mb-1">평균단가</p><Input type="number" value={form.avgPrice} onChange={e => setForm(f => ({ ...f, avgPrice: Number(e.target.value) }))} /></div>
              <div><p className="text-xs mb-1">현재가</p><Input type="number" value={form.currentPrice} onChange={e => setForm(f => ({ ...f, currentPrice: Number(e.target.value) }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!form.ticker || !form.name}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
