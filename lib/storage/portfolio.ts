import { getItem, setItem } from "./base";
import type { Holding, StrategyMemo, WatchlistItem } from "../types";

export function getHoldings(): Holding[] {
  return getItem<Holding[]>("holdings", defaultHoldings);
}
export function saveHoldings(holdings: Holding[]): void {
  setItem("holdings", holdings);
}

export function getWatchlist(): WatchlistItem[] { return getItem<WatchlistItem[]>("watchlist", []); }
export function saveWatchlist(items: WatchlistItem[]): void { setItem("watchlist", items); }

export function getMemos(): StrategyMemo[] {
  return getItem<StrategyMemo[]>("strategy-memos", []);
}
export function saveMemos(memos: StrategyMemo[]): void {
  setItem("strategy-memos", memos);
}

const defaultHoldings: Holding[] = [
  { id: "1", ticker: "005930", name: "삼성전자",  market: "KR", sector: "semiconductor", quantity: 50,  avgPrice: 68000,  currentPrice: 75400, currency: "KRW" },
  { id: "2", ticker: "000660", name: "SK하이닉스", market: "KR", sector: "semiconductor", quantity: 20,  avgPrice: 130000, currentPrice: 158000, currency: "KRW" },
  { id: "3", ticker: "AAPL",   name: "Apple",     market: "US", sector: "tech",          quantity: 10,  avgPrice: 170,    currentPrice: 189,   currency: "USD" },
  { id: "4", ticker: "TSLA",   name: "Tesla",     market: "US", sector: "consumer",      quantity: 5,   avgPrice: 240,    currentPrice: 198,   currency: "USD" },
  { id: "5", ticker: "NVDA",   name: "NVIDIA",    market: "US", sector: "semiconductor", quantity: 8,   avgPrice: 480,    currentPrice: 875,   currency: "USD" },
];
