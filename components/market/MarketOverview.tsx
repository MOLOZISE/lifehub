"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

// 콤팩트 칩 (홈 위젯 등)
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

// 풀모드 — 인기 종목 카드와 동일한 카드 스타일
function MarketCard({ item }: { item: MarketItem }) {
  const up = item.changeRate >= 0;
  const pct = (up ? "+" : "") + item.changeRate.toFixed(2) + "%";
  return (
    <div className="bg-muted/30 hover:bg-muted/60 rounded-2xl p-3 transition-colors flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground leading-tight truncate">{item.label}</span>
      <span className={`text-xl font-bold tabular-nums leading-none ${up ? "text-red-500" : "text-blue-500"}`}>
        {pct}
      </span>
      <span className="text-[11px] text-muted-foreground tabular-nums">{fmt(item)}</span>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  index: "지수",
  fx: "환율",
  commodity: "원자재",
  stock: "주식",
  bond: "채권",
};

const CATEGORY_ORDER = ["index", "fx", "commodity", "stock", "bond"];

const CATEGORIES = ["지수", "환율", "원자재", "주식", "채권"];

interface Props {
  compact?: boolean;
  refreshKey?: number; // 변경 시 force 새로고침 트리거
}

export function MarketOverview({ compact = false, refreshKey }: Props) {
  const [market, setMarket] = useState<Record<string, MarketItem>>({});
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [selected, setSelected] = useState<string[]>(DEFAULT_SYMBOLS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState<string[]>([]);
  const staleTimerRef = useRef<number | undefined>(undefined);

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
      const json = await res.json();
      if (Object.keys(json.data ?? {}).length > 0) {
        setMarket(json.data);
        setLastUpdate(json.cachedAt ?? Date.now());
        setIsStale(!!json.stale);
      }
      if (json.fetchError) {
        setFetchError(json.fetchError);
      } else if (json.errors?.length) {
        setFetchError(`일부 데이터 조회 실패: ${json.errors.join(", ")}`);
      } else if (!res.ok && json.error) {
        setFetchError(json.error);
      } else {
        setFetchError(null);
      }

      // stale 데이터를 받은 경우: 서버 백그라운드 갱신이 끝날 때까지 4초 후 재폴링
      if (json.stale && !json.fetchError) {
        staleTimerRef.current = window.setTimeout(() => load(), 4000);
      }
    } catch {
      setFetchError("네트워크 오류로 시황 데이터를 불러올 수 없습니다");
    } finally {
      setFetching(false);
    }
  }, [selected]);

  useEffect(() => {
    clearTimeout(staleTimerRef.current);
    load();
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // 외부에서 refreshKey가 바뀌면 force 새로고침
  const prevRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      clearTimeout(staleTimerRef.current);
      load(true);
    }
  }, [refreshKey, load]);

  useEffect(() => () => clearTimeout(staleTimerRef.current), []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, MARKET_REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

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

  // 카테고리 그룹
  const byType = CATEGORY_ORDER.reduce((acc, type) => {
    const group = sortedItems.filter(i => i.type === type);
    if (group.length > 0) acc[type] = group;
    return acc;
  }, {} as Record<string, MarketItem[]>);

  if (items.length === 0) return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-center h-14 text-xs text-muted-foreground gap-2">
        {fetching
          ? <><RefreshCw className="w-3 h-3 animate-spin" />시황 로딩 중...</>
          : <>
              <span>{fetchError ?? "시황 데이터를 불러올 수 없습니다"}</span>
              <button onClick={() => load(true)} className="text-primary hover:underline text-xs shrink-0">재시도</button>
            </>
        }
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* 에러/stale 배너 */}
      {fetchError && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
          <span className="shrink-0">⚠️</span>
          <span className="flex-1">{fetchError}</span>
          <button onClick={() => load(true)} className="shrink-0 underline hover:no-underline">재시도</button>
        </div>
      )}
      {!fetchError && isStale && lastUpdate && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-muted/60 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>최신 데이터 갱신 중... ({new Date(lastUpdate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준)</span>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        {!compact && <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">글로벌 시황</h3>}
        <div className={`flex items-center gap-2 ${compact ? "w-full justify-end" : ""}`}>
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

      {compact ? (
        /* compact 모드: 가로 스크롤 칩 */
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex gap-2 min-w-max">
            {CATEGORY_ORDER.flatMap((type, ci) => {
              const group = byType[type];
              if (!group) return [];
              return [
                ...(ci > 0 ? [<div key={`sep-${type}`} className="w-px bg-border mx-0.5 self-stretch" />] : []),
                ...group.map(i => <MarketChip key={i.symbol} item={i} />),
              ];
            })}
          </div>
        </div>
      ) : (
        /* 풀 모드: 카테고리별 3열 카드 그리드 */
        <div className="space-y-4">
          {CATEGORY_ORDER.filter(type => byType[type]).map(type => (
            <div key={type}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {CATEGORY_LABELS[type]}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {byType[type].map(item => (
                  <MarketCard key={item.symbol} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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
