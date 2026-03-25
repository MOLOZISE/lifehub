"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, Settings2, Check, Plus, X, Search } from "lucide-react";
import type { MarketItem } from "@/lib/market-symbols";
import { ALL_SYMBOLS, DEFAULT_SYMBOLS } from "@/lib/market-symbols";
import { searchStocks, MARKET_LABELS, type StockItem } from "@/lib/stock-list";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MARKET_REFRESH_INTERVAL = 5 * 60 * 1000; // 5분
const LS_KEY = "market_selected_symbols";
const LS_CUSTOM_KEY = "market_custom_symbols";

interface CustomSymbol { symbol: string; label: string; }

function getSelectedSymbols(): string[] {
  if (typeof window === "undefined") return DEFAULT_SYMBOLS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_SYMBOLS;
}

function saveSelectedSymbols(symbols: string[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(symbols)); } catch { /* ignore */ }
}

function getCustomSymbols(): CustomSymbol[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_CUSTOM_KEY);
    if (raw) return JSON.parse(raw) as CustomSymbol[];
  } catch { /* ignore */ }
  return [];
}

function saveCustomSymbols(customs: CustomSymbol[]) {
  try { localStorage.setItem(LS_CUSTOM_KEY, JSON.stringify(customs)); } catch { /* ignore */ }
}

function fmt(item: MarketItem) {
  if (item.type === "fx") return item.price.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  if (item.type === "index") return item.price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (item.type === "bond") return item.price.toFixed(2) + "%";
  return item.price.toFixed(2);
}

function MarketStateLabel({ state }: { state?: string }) {
  if (!state || state === "REGULAR") return null;
  const label = state === "PRE" ? "프리" : state === "POST" ? "시간외" : state === "CLOSED" ? "마감" : null;
  if (!label) return null;
  return (
    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium leading-none">
      {label}
    </span>
  );
}

// 컴팩트 칩 (홈 위젯 — 2열 그리드)
function MarketChip({ item }: { item: MarketItem }) {
  const up = item.changeRate >= 0;
  // 프리장/시간외 우선 표시
  const extPrice = item.marketState === "PRE" ? item.preMarketPrice
    : item.marketState === "POST" ? item.postMarketPrice : undefined;
  const extRate = item.marketState === "PRE" ? item.preMarketChangeRate
    : item.marketState === "POST" ? item.postMarketChangeRate : undefined;
  const displayRate = extRate ?? item.changeRate;
  const displayUp = displayRate >= 0;

  return (
    <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-muted/60 hover:bg-muted transition-colors gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground truncate">{item.label}</span>
          <MarketStateLabel state={item.marketState} />
        </div>
        <span className="text-sm font-semibold leading-tight block">{extPrice !== undefined ? fmt({ ...item, price: extPrice }) : fmt(item)}</span>
      </div>
      <span className={`text-[11px] font-semibold shrink-0 ${displayUp ? "text-green-500" : "text-red-500"}`}>
        {displayUp ? "▲" : "▼"} {Math.abs(displayRate).toFixed(2)}%
      </span>
    </div>
  );
}

// 풀모드 카드
function MarketCard({ item }: { item: MarketItem }) {
  const up = item.changeRate >= 0;
  const pct = (up ? "+" : "") + item.changeRate.toFixed(2) + "%";
  const extRate = item.marketState === "PRE" ? item.preMarketChangeRate
    : item.marketState === "POST" ? item.postMarketChangeRate : undefined;

  return (
    <div className="bg-muted/30 hover:bg-muted/60 rounded-2xl p-3 transition-colors flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground leading-tight truncate flex-1">{item.label}</span>
        <MarketStateLabel state={item.marketState} />
      </div>
      <span className={`text-xl font-bold tabular-nums leading-none ${up ? "text-red-500" : "text-blue-500"}`}>
        {pct}
      </span>
      <span className="text-[11px] text-muted-foreground tabular-nums">{fmt(item)}</span>
      {extRate !== undefined && (
        <span className={`text-[10px] font-medium ${extRate >= 0 ? "text-red-400" : "text-blue-400"}`}>
          {item.marketState === "PRE" ? "프리" : "시간외"} {extRate >= 0 ? "+" : ""}{extRate.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  index: "지수", fx: "환율", commodity: "원자재", stock: "주식", bond: "채권",
};
const CATEGORY_ORDER = ["index", "fx", "commodity", "stock", "bond"];
const CATEGORIES = ["지수", "환율", "원자재", "주식", "채권"];

interface Props {
  compact?: boolean;
  refreshKey?: number;
}

export function MarketOverview({ compact = false, refreshKey }: Props) {
  const [market, setMarket] = useState<Record<string, MarketItem>>({});
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [selected, setSelected] = useState<string[]>(DEFAULT_SYMBOLS);
  const [customSymbols, setCustomSymbols] = useState<CustomSymbol[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState<string[]>([]);
  const [draftCustoms, setDraftCustoms] = useState<CustomSymbol[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [suggestions, setSuggestions] = useState<StockItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  const staleTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setSelected(getSelectedSymbols());
    setCustomSymbols(getCustomSymbols());
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

  const prevRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      clearTimeout(staleTimerRef.current);
      load(true);
    }
  }, [refreshKey, load]);

  useEffect(() => () => clearTimeout(staleTimerRef.current), []);

  // 자동 갱신 없음 — 수동 새로고침만 사용 (API 호출량 절약)

  function openSettings() {
    setDraftSelected([...selected]);
    setDraftCustoms([...customSymbols]);
    setCustomInput("");
    setSettingsOpen(true);
  }

  function toggleDraft(symbol: string) {
    setDraftSelected(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  }

  function addCustomDraft(overrideTicker?: string, overrideName?: string) {
    const sym = (overrideTicker ?? customInput).trim().toUpperCase();
    if (!sym) return;
    const label = overrideName ?? sym;
    if (!draftCustoms.find(c => c.symbol === sym)) {
      setDraftCustoms(prev => [...prev, { symbol: sym, label }]);
    }
    if (!draftSelected.includes(sym)) {
      setDraftSelected(prev => [...prev, sym]);
    }
    setCustomInput("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleCustomInput(value: string) {
    setCustomInput(value);
    if (value.trim().length >= 1) {
      const results = searchStocks(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function pickSuggestion(item: StockItem) {
    addCustomDraft(item.ticker, item.name);
  }

  function removeCustomDraft(symbol: string) {
    setDraftCustoms(prev => prev.filter(c => c.symbol !== symbol));
    setDraftSelected(prev => prev.filter(s => s !== symbol));
  }

  function applySettings() {
    const newSelected = draftSelected.length > 0 ? draftSelected : DEFAULT_SYMBOLS;
    saveSelectedSymbols(newSelected);
    saveCustomSymbols(draftCustoms);
    setSelected(newSelected);
    setCustomSymbols(draftCustoms);
    setSettingsOpen(false);
    load(true, newSelected);
  }

  // 커스텀 심볼을 포함한 전체 심볼 메타 리스트
  const allSymbolsMerged = [
    ...ALL_SYMBOLS,
    ...customSymbols.filter(c => !ALL_SYMBOLS.find(a => a.symbol === c.symbol)).map(c => ({
      symbol: c.symbol, label: c.label, currency: "USD", type: "stock" as const, category: "주식", defaultOn: false,
    })),
  ];

  const items = Object.values(market);
  const sortedItems = selected
    .map(sym => items.find(i => i.symbol === sym))
    .filter(Boolean) as MarketItem[];

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

      {compact ? (
        /* compact 모드: 4열 그리드 */
        <div className="grid grid-cols-4 gap-1.5">
          {sortedItems.map(i => <MarketChip key={i.symbol} item={i} />)}
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
            <p className="text-xs text-muted-foreground">표시할 종목을 선택하거나 직접 추가하세요</p>
          </SheetHeader>
          <div className="space-y-4 pb-4">
            {/* 커스텀 종목 추가 입력 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">종목 직접 추가 (Yahoo Finance 티커)</p>
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    value={customInput}
                    onChange={e => handleCustomInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomDraft(); setShowSuggestions(false); } }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    placeholder="종목명 또는 티커 검색..."
                    className="h-8 text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={() => { addCustomDraft(); setShowSuggestions(false); }} className="h-8 px-2">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 top-9 left-0 right-8 bg-popover border rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map(item => (
                      <button
                        key={item.ticker}
                        onMouseDown={() => pickSuggestion(item)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-primary">{item.ticker}</span>
                          <span>{item.name}</span>
                        </div>
                        <span className="text-muted-foreground text-[10px]">{MARKET_LABELS[item.market]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* 커스텀 종목 목록 */}
              {draftCustoms.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {draftCustoms.map(c => (
                    <div key={c.symbol} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                      {c.symbol}
                      <button onClick={() => removeCustomDraft(c.symbol)} className="hover:text-destructive transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1.5">
                티커 직접 입력도 가능: 005930.KS (삼성전자) / NQ=F (나스닥100 선물)
              </p>
            </div>

            {/* 기본 종목 */}
            {CATEGORIES.map(cat => {
              const catSymbols = allSymbolsMerged.filter(s => s.category === cat);
              if (catSymbols.length === 0) return null;
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
            <Button variant="outline" size="sm" onClick={() => { setDraftSelected(DEFAULT_SYMBOLS); setDraftCustoms([]); }} className="text-xs">
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
