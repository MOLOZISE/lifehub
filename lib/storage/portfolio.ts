import { getItem, setItem } from "./base";
import type { Holding, StrategyMemo, WatchlistItem, WatchlistGroup } from "../types";

export function getHoldings(): Holding[] {
  return getItem<Holding[]>("holdings", defaultHoldings);
}
export function saveHoldings(holdings: Holding[]): void {
  setItem("holdings", holdings);
}

export function getWatchlist(): WatchlistItem[] { return getItem<WatchlistItem[]>("watchlist", []); }
export function saveWatchlist(items: WatchlistItem[]): void { setItem("watchlist", items); }
export function upsertWatchlistItem(item: WatchlistItem): void {
  const items = getWatchlist();
  const idx = items.findIndex(i => i.id === item.id);
  if (idx >= 0) items[idx] = item; else items.push(item);
  saveWatchlist(items);
}
export function deleteWatchlistItem(id: string): void {
  saveWatchlist(getWatchlist().filter(i => i.id !== id));
}

export function getWatchlistGroups(): WatchlistGroup[] { return getItem<WatchlistGroup[]>("watchlist-groups", []); }
export function saveWatchlistGroups(groups: WatchlistGroup[]): void { setItem("watchlist-groups", groups); }
export function upsertWatchlistGroup(group: WatchlistGroup): void {
  const groups = getWatchlistGroups();
  const idx = groups.findIndex(g => g.id === group.id);
  if (idx >= 0) groups[idx] = group; else groups.push(group);
  saveWatchlistGroups(groups);
}
export function deleteWatchlistGroup(id: string): void {
  // Unlink items from this group (move to ungrouped)
  const items = getWatchlist().map(i => i.groupId === id ? { ...i, groupId: undefined } : i);
  saveWatchlist(items);
  saveWatchlistGroups(getWatchlistGroups().filter(g => g.id !== id));
}

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
