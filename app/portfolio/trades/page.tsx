"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface StockTrade {
  id: string;
  ticker: string;
  name: string;
  market: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  memo: string | null;
  tradedAt: string;
}

interface TickerSummary {
  ticker: string;
  name: string;
  currency: string;
  avgPrice: number;
  totalQty: number;
  totalCost: number;
  realizedPnl: number;
}

const emptyForm = {
  ticker: "",
  name: "",
  market: "KR" as "KR" | "US",
  type: "buy" as "buy" | "sell",
  quantity: "",
  price: "",
  fee: "",
  currency: "KRW" as "KRW" | "USD",
  memo: "",
  tradedAt: new Date().toISOString().slice(0, 16),
};

function formatCurrency(amount: number, currency: string) {
  if (currency === "KRW") return `₩${amount.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcSummaries(trades: StockTrade[]): TickerSummary[] {
  const map: Record<string, TickerSummary> = {};

  // Process in chronological order for avg price
  const sorted = [...trades].sort((a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());

  for (const t of sorted) {
    if (!map[t.ticker]) {
      map[t.ticker] = { ticker: t.ticker, name: t.name, currency: t.currency, avgPrice: 0, totalQty: 0, totalCost: 0, realizedPnl: 0 };
    }
    const s = map[t.ticker];
    if (t.type === "buy") {
      s.totalCost += t.quantity * t.price + t.fee;
      s.totalQty += t.quantity;
      s.avgPrice = s.totalQty > 0 ? s.totalCost / s.totalQty : 0;
    } else {
      // sell: realized P&L = (sell price - avg price) * qty - fee
      s.realizedPnl += (t.price - s.avgPrice) * t.quantity - t.fee;
      s.totalQty -= t.quantity;
      if (s.totalQty > 0) {
        s.totalCost -= s.avgPrice * t.quantity;
      } else {
        s.totalQty = 0;
        s.totalCost = 0;
        s.avgPrice = 0;
      }
    }
  }

  return Object.values(map).filter(s => s.totalQty > 0 || s.realizedPnl !== 0);
}

export default function TradesPage() {
  const [trades, setTrades] = useState<StockTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StockTrade | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterTicker, setFilterTicker] = useState("");

  async function loadTrades() {
    const res = await fetch("/api/portfolio/trades");
    if (res.ok) setTrades(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadTrades(); }, []);

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(t: StockTrade) {
    setEditTarget(t);
    setForm({
      ticker: t.ticker, name: t.name,
      market: t.market as "KR" | "US",
      type: t.type,
      quantity: String(t.quantity),
      price: String(t.price),
      fee: String(t.fee),
      currency: t.currency as "KRW" | "USD",
      memo: t.memo ?? "",
      tradedAt: new Date(t.tradedAt).toISOString().slice(0, 16),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.ticker || !form.name || !form.quantity || !form.price) {
      toast.error("티커, 종목명, 수량, 단가는 필수입니다.");
      return;
    }
    const payload = {
      ticker: form.ticker.toUpperCase(),
      name: form.name,
      market: form.market,
      type: form.type,
      quantity: Number(form.quantity),
      price: Number(form.price),
      fee: Number(form.fee || 0),
      currency: form.currency,
      memo: form.memo || null,
      tradedAt: new Date(form.tradedAt).toISOString(),
    };

    const url = editTarget ? `/api/portfolio/trades/${editTarget.id}` : "/api/portfolio/trades";
    const method = editTarget ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success(editTarget ? "수정되었습니다." : "거래가 기록되었습니다.");
    setDialogOpen(false);
    loadTrades();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 거래 기록을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/portfolio/trades/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    toast.success("삭제되었습니다.");
    loadTrades();
  }

  const summaries = calcSummaries(trades);
  const filtered = filterTicker
    ? trades.filter(t => t.ticker.toLowerCase().includes(filterTicker.toLowerCase()) || t.name.includes(filterTicker))
    : trades;

  const totalRealizedPnl = summaries.reduce((s, x) => s + x.realizedPnl, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">거래 이력</h1>
        <Button size="sm" onClick={openAdd}><Plus className="w-3.5 h-3.5 mr-1" />거래 추가</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">총 거래 건수</p>
            <p className="text-2xl font-bold">{trades.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">보유 종목</p>
            <p className="text-2xl font-bold">{summaries.filter(s => s.totalQty > 0).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">실현 손익 (KRW)</p>
            <p className={`text-2xl font-bold ${totalRealizedPnl >= 0 ? "text-red-500" : "text-blue-500"}`}>
              {totalRealizedPnl >= 0 ? "+" : ""}{totalRealizedPnl.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">매수 / 매도</p>
            <p className="text-2xl font-bold">
              <span className="text-red-500">{trades.filter(t => t.type === "buy").length}</span>
              <span className="text-muted-foreground text-base"> / </span>
              <span className="text-blue-500">{trades.filter(t => t.type === "sell").length}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-ticker summary */}
      {summaries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">종목별 평균단가 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">종목</th>
                    <th className="px-3 py-2 text-right">보유수량</th>
                    <th className="px-3 py-2 text-right">평균단가</th>
                    <th className="px-3 py-2 text-right">총 매입금액</th>
                    <th className="px-3 py-2 text-right">실현손익</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map(s => (
                    <tr key={s.ticker} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{s.ticker}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">{s.totalQty > 0 ? s.totalQty.toLocaleString() : <span className="text-muted-foreground">매도완료</span>}</td>
                      <td className="px-3 py-2.5 text-right">{s.avgPrice > 0 ? formatCurrency(s.avgPrice, s.currency) : "-"}</td>
                      <td className="px-3 py-2.5 text-right">{s.totalCost > 0 ? formatCurrency(s.totalCost, s.currency) : "-"}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${s.realizedPnl > 0 ? "text-red-500" : s.realizedPnl < 0 ? "text-blue-500" : "text-muted-foreground"}`}>
                        {s.realizedPnl !== 0 ? (s.realizedPnl > 0 ? "+" : "") + formatCurrency(s.realizedPnl, s.currency) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trade log */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">거래 내역</CardTitle>
            <Input
              placeholder="티커 또는 종목명 검색"
              className="w-44 h-7 text-xs"
              value={filterTicker}
              onChange={e => setFilterTicker(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">거래 내역이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">일시</th>
                    <th className="px-3 py-2 text-left">종목</th>
                    <th className="px-3 py-2 text-center">구분</th>
                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-right">단가</th>
                    <th className="px-3 py-2 text-right">수수료</th>
                    <th className="px-3 py-2 text-right">체결금액</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const total = t.quantity * t.price;
                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(t.tradedAt).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })}
                          <br />
                          <span>{new Date(t.tradedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            {t.ticker}
                            <Badge variant="outline" className="text-[10px] h-3.5 px-1">{t.market}</Badge>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {t.type === "buy" ? (
                            <span className="inline-flex items-center gap-1 text-red-500 font-medium text-xs">
                              <ArrowDownCircle className="w-3.5 h-3.5" /> 매수
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blue-500 font-medium text-xs">
                              <ArrowUpCircle className="w-3.5 h-3.5" /> 매도
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">{t.quantity.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right">{formatCurrency(t.price, t.currency)}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground text-xs">{t.fee > 0 ? formatCurrency(t.fee, t.currency) : "-"}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(total, t.currency)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(t)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(t.id)}>
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
          )}
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "거래 수정" : "거래 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1">구분</p>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as "buy" | "sell" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">매수</SelectItem>
                    <SelectItem value="sell">매도</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs mb-1">시장</p>
                <Select value={form.market} onValueChange={v => setForm(f => ({ ...f, market: v as "KR" | "US", currency: v === "KR" ? "KRW" : "USD" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KR">KR (원)</SelectItem>
                    <SelectItem value="US">US (달러)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1">티커</p>
                <Input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} placeholder="예: 005930" />
              </div>
              <div>
                <p className="text-xs mb-1">종목명</p>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 삼성전자" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs mb-1">수량</p>
                <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <p className="text-xs mb-1">단가</p>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <p className="text-xs mb-1">수수료</p>
                <Input type="number" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {form.quantity && form.price && (
              <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
                체결금액: <span className="font-medium text-foreground">
                  {formatCurrency(Number(form.quantity) * Number(form.price), form.currency)}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs mb-1">거래일시</p>
              <Input type="datetime-local" value={form.tradedAt} onChange={e => setForm(f => ({ ...f, tradedAt: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs mb-1">메모 (선택)</p>
              <Input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="메모를 입력하세요" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
