"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Settings2, Check } from "lucide-react";
import type { MarketItem } from "@/lib/market-symbols";
import { ALL_SYMBOLS, DEFAULT_SYMBOLS } from "@/lib/market-symbols";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const MARKET_REFRESH_INTERVAL = 5 * 60 * 1000; // 5분
const LS_KEY = "market_selected_symbols";

function getSelectedSymbols(): string[] {
  if (typeof window === "undefined") return DEFAULT_SYMBOLS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      // 유효한 심볼만 필터
      const valid = parsed.filter(s => ALL_SYMBOLS.some(a => a.symbol === s));
      if (valid.length > 0) return valid;
    }
  } catch { /* ignore */ }
  return DEFAULT_SYMBOLS;
}

function saveSelectedSymbols(symbols: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(symbols)); } catch { /* ignore */ }
}

function fmt(item: MarketItem) {
  if (item.type === "fx") return item.price.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  if (item.type === "index") return item.price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (item.type === "bond") return item.price.toFixed(2) + "%";
  return item.price.toFixed(2);
}

function MarketChip({ item }: { item: MarketItem }) {
  const up = item.changeRate >= 0;
  return (
    <div className="flex flex-col min-w-[80px] px-2.5 py-1.5 rounded-lg bg-muted/60 hover:bg-muted transition-colors shrink-0">
      <span className="text-[10px] text-muted-foreground leading-tight truncate">{item.label}</span>
      <span className="text-sm font-semibold leading-tight mt-0.5">{fmt(item)}</span>
      <span className={`text-[10px] font-medium ${up ? "text-green-500" : "text-red-500"}`}>
        {up ? "▲" : "▼"} {Math.abs(item.changeRate).toFixed(2)}%
      </span>
    </div>
  );
}

const CATEGORIES = ["지수", "환율", "원자재", "주식", "채권"];

interface Props {
  /** 헤더 타이틀 숨기기 (홈 위젯 등 공간이 좁은 곳에서) */
  compact?: boolean;
}

export function MarketOverview({ compact = false }: Props) {
  const [market, setMarket] = useState<Record<string, MarketItem>>({});
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [selected, setSelected] = useState<string[]>(DEFAULT_SYMBOLS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState<string[]>([]);

  // localStorage는 클라이언트에서만 읽기
  useEffect(() => {
    setSelected(getSelectedSymbols());
  }, []);

  const load = useCallback(async (force = false, symbols?: string[]) => {
    const syms = symbols ?? selected;
    setFetching(true);
    try {
      const params = new URLSearchParams();
      if (force) params.set("refresh", "1");
      params.set("symbols", syms.join(","));
      const res = await fetch(`/api/market/overview?${params}`);
      if (res.ok) {
        const json = await res.json();
        setMarket(json.data ?? {});
        setLastUpdate(json.cachedAt ?? Date.now());
      }
    } finally {
      setFetching(false);
    }
  }, [selected]);

  useEffect(() => { load(); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, MARKET_REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  // 페이지 포커스 복귀 시 캐시가 만료됐으면 갱신
  useEffect(() => {
    function onFocus() {
      if (!lastUpdate || Date.now() - lastUpdate > MARKET_REFRESH_INTERVAL) load();
    }
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [load, lastUpdate]);

  function openSettings() {
    setDraftSelected([...selected]);
    setSettingsOpen(true);
  }

  function toggleDraft(symbol: string) {
    setDraftSelected(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  }

  function applySettings() {
    const newSelected = draftSelected.length > 0 ? draftSelected : DEFAULT_SYMBOLS;
    saveSelectedSymbols(newSelected);
    setSelected(newSelected);
    setSettingsOpen(false);
    load(true, newSelected);
  }

  const items = Object.values(market);
  const sortedItems = selected
    .map(sym => items.find(i => i.symbol === sym))
    .filter(Boolean) as MarketItem[];

  const indices = sortedItems.filter(i => i.type === "index");
  const fx = sortedItems.filter(i => i.type === "fx");
  const commodities = sortedItems.filter(i => i.type === "commodity");
  const stocks = sortedItems.filter(i => i.type === "stock");
  const bonds = sortedItems.filter(i => i.type === "bond");

  if (items.length === 0) return (
    <div className="flex items-center justify-center h-14 text-xs text-muted-foreground gap-2">
      {fetching
        ? <><RefreshCw className="w-3 h-3 animate-spin" />시황 로딩 중...</>
        : <>
            <span>시황 데이터 없음</span>
            <button onClick={() => load(true)} className="text-primary hover:underline text-xs">재시도</button>
          </>
      }
    </div>
  );

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">글로벌 시황</h3>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(lastUpdate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
              </span>
            )}
            <button onClick={openSettings} className="text-muted-foreground hover:text-foreground transition-colors" title="종목 설정">
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => load(true)} disabled={fetching} className="text-muted-foreground hover:text-foreground transition-colors" title="새로고침">
              <RefreshCw className={`w-3 h-3 ${fetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      )}

      {compact && (
        <div className="flex items-center justify-end gap-1.5 mb-1">
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(lastUpdate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
            </span>
          )}
          <button onClick={openSettings} className="text-muted-foreground hover:text-foreground transition-colors">
            <Settings2 className="w-3 h-3" />
          </button>
          <button onClick={() => load(true)} disabled={fetching} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-3 h-3 ${fetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex gap-2 min-w-max">
          {indices.length > 0 && <>{indices.map(i => <MarketChip key={i.symbol} item={i} />)}<div className="w-px bg-border mx-0.5" /></>}
          {fx.length > 0 && <>{fx.map(i => <MarketChip key={i.symbol} item={i} />)}</>}
          {commodities.length > 0 && <>{<div className="w-px bg-border mx-0.5" />}{commodities.map(i => <MarketChip key={i.symbol} item={i} />)}</>}
          {bonds.length > 0 && <>{<div className="w-px bg-border mx-0.5" />}{bonds.map(i => <MarketChip key={i.symbol} item={i} />)}</>}
          {stocks.length > 0 && <>{<div className="w-px bg-border mx-0.5" />}{stocks.map(i => <MarketChip key={i.symbol} item={i} />)}</>}
        </div>
      </div>

      {/* 종목 선택 Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto pb-safe">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-base">시황 종목 설정</SheetTitle>
            <p className="text-xs text-muted-foreground">표시할 종목을 선택하세요</p>
          </SheetHeader>
          <div className="space-y-4 pb-4">
            {CATEGORIES.map(cat => {
              const catSymbols = ALL_SYMBOLS.filter(s => s.category === cat);
              return (
                <div key={cat}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {catSymbols.map(s => {
                      const on = draftSelected.includes(s.symbol);
                      return (
                        <button
                          key={s.symbol}
                          onClick={() => toggleDraft(s.symbol)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                            on
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border text-muted-foreground hover:border-foreground/40"
                          }`}
                        >
                          {on && <Check className="w-3 h-3" />}
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setDraftSelected(DEFAULT_SYMBOLS)} className="text-xs">
              기본값으로
            </Button>
            <Button size="sm" onClick={applySettings} className="flex-1">
              적용 ({draftSelected.length}개)
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
