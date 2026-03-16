"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, BarChart2, Newspaper, ExternalLink, ChevronDown, ChevronUp, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { PortfolioSector } from "@/lib/types";

interface WatchlistGroup {
  id: string; name: string; emoji: string; color: string; description?: string;
  createdAt: string; items?: WatchlistItem[];
}
interface WatchlistItem {
  id: string; ticker: string; name: string; market: "KR" | "US";
  sector?: PortfolioSector; currentPrice: number; targetPrice?: number;
  currency: string; memo?: string; groupId?: string; addedAt: string;
}
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_COLORS = [
  { key: "blue",   label: "파랑",  bg: "bg-blue-100 dark:bg-blue-950/40",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-300 dark:border-blue-700" },
  { key: "violet", label: "보라",  bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", border: "border-violet-300 dark:border-violet-700" },
  { key: "green",  label: "초록",  bg: "bg-green-100 dark:bg-green-950/40",  text: "text-green-700 dark:text-green-300",  border: "border-green-300 dark:border-green-700" },
  { key: "amber",  label: "주황",  bg: "bg-amber-100 dark:bg-amber-950/40",  text: "text-amber-700 dark:text-amber-300",  border: "border-amber-300 dark:border-amber-700" },
  { key: "red",    label: "빨강",  bg: "bg-red-100 dark:bg-red-950/40",      text: "text-red-700 dark:text-red-300",      border: "border-red-300 dark:border-red-700" },
  { key: "pink",   label: "분홍",  bg: "bg-pink-100 dark:bg-pink-950/40",    text: "text-pink-700 dark:text-pink-300",    border: "border-pink-300 dark:border-pink-700" },
  { key: "teal",   label: "청록",  bg: "bg-teal-100 dark:bg-teal-950/40",    text: "text-teal-700 dark:text-teal-300",    border: "border-teal-300 dark:border-teal-700" },
  { key: "gray",   label: "회색",  bg: "bg-gray-100 dark:bg-gray-800/40",    text: "text-gray-700 dark:text-gray-300",    border: "border-gray-300 dark:border-gray-600" },
];

const SECTOR_LABELS: Record<PortfolioSector, string> = {
  tech: "IT/기술", semiconductor: "반도체", finance: "금융", healthcare: "헬스케어",
  energy: "에너지", consumer: "소비재", industrial: "산업재", materials: "소재",
  real_estate: "부동산", utilities: "유틸리티", communication: "통신", etf: "ETF", other: "기타",
};

function getColorStyle(colorKey: string) {
  return GROUP_COLORS.find(c => c.key === colorKey) ?? GROUP_COLORS[0];
}

// ─── Group Dialog ──────────────────────────────────────────────────────────────

const emptyGroupForm = { name: "", emoji: "⭐", description: "", color: "blue" };

function GroupDialog({
  open, onClose, initial, onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: WatchlistGroup;
  onSave: (g: WatchlistGroup) => void;
}) {
  const [form, setForm] = useState(emptyGroupForm);

  useEffect(() => {
    if (open) setForm(initial ? { name: initial.name, emoji: initial.emoji, description: initial.description ?? "", color: initial.color } : emptyGroupForm);
  }, [open, initial]);

  function handleSave() {
    if (!form.name.trim()) return;
    onSave({
      id: initial?.id,
      name: form.name.trim(),
      emoji: form.emoji || "⭐",
      description: form.description || undefined,
      color: form.color,
    } as WatchlistGroup);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "그룹 편집" : "관심 그룹 만들기"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="w-20">
              <p className="text-xs mb-1 font-medium">이모지</p>
              <Input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} className="text-center text-lg" maxLength={2} />
            </div>
            <div className="flex-1">
              <p className="text-xs mb-1 font-medium">그룹 이름 *</p>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 코인주, 양자주, 2차전지" />
            </div>
          </div>
          <div>
            <p className="text-xs mb-1 font-medium">설명 (선택)</p>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="예: 고위험 테마주 모음" />
          </div>
          <div>
            <p className="text-xs mb-2 font-medium">색상</p>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c.key }))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${c.bg} ${c.text} ${c.border} ${form.color === c.key ? "ring-2 ring-offset-1 ring-current" : "opacity-60"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={!form.name.trim()}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ticker Dialog ─────────────────────────────────────────────────────────────

const emptyTickerForm = {
  ticker: "", name: "", market: "KR" as "KR" | "US", sector: "other" as PortfolioSector,
  currentPrice: "", targetPrice: "", memo: "", groupId: "",
};

function TickerDialog({
  open, onClose, initial, groups, defaultGroupId, onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: WatchlistItem;
  groups: WatchlistGroup[];
  defaultGroupId?: string;
  onSave: (item: WatchlistItem) => void;
}) {
  const [form, setForm] = useState(emptyTickerForm);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          ticker: initial.ticker, name: initial.name, market: initial.market,
          sector: initial.sector ?? "other", currentPrice: String(initial.currentPrice),
          targetPrice: initial.targetPrice ? String(initial.targetPrice) : "",
          memo: initial.memo ?? "", groupId: initial.groupId ?? "",
        });
      } else {
        setForm({ ...emptyTickerForm, groupId: defaultGroupId ?? "" });
      }
    }
  }, [open, initial, defaultGroupId]);

  function handleSave() {
    if (!form.ticker.trim() || !form.name.trim()) return;
    onSave({
      id: initial?.id,
      ticker: form.ticker.trim().toUpperCase(),
      name: form.name.trim(),
      market: form.market,
      sector: form.sector,
      currency: form.market === "KR" ? "KRW" : "USD",
      currentPrice: Number(form.currentPrice) || 0,
      targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
      memo: form.memo || undefined,
      groupId: form.groupId || undefined,
    } as WatchlistItem);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "종목 편집" : "관심 종목 추가"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs mb-1 font-medium">티커 *</p>
              <Input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} placeholder="AAPL / 005930" className="uppercase" />
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">시장</p>
              <Select value={form.market} onValueChange={v => v && setForm(f => ({ ...f, market: v as "KR" | "US" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KR">🇰🇷 한국</SelectItem>
                  <SelectItem value="US">🇺🇸 미국</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <p className="text-xs mb-1 font-medium">종목명 *</p>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 삼성전자, Apple" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs mb-1 font-medium">현재가</p>
              <Input type="number" value={form.currentPrice} onChange={e => setForm(f => ({ ...f, currentPrice: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">목표가</p>
              <Input type="number" value={form.targetPrice} onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))} placeholder="선택" />
            </div>
          </div>
          <div>
            <p className="text-xs mb-1 font-medium">섹터</p>
            <Select value={form.sector} onValueChange={v => v && setForm(f => ({ ...f, sector: v as PortfolioSector }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(SECTOR_LABELS) as [PortfolioSector, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {groups.length > 0 && (
            <div>
              <p className="text-xs mb-1 font-medium">그룹</p>
              <Select value={form.groupId || "none"} onValueChange={v => v && setForm(f => ({ ...f, groupId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="그룹 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">그룹 없음</SelectItem>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <p className="text-xs mb-1 font-medium">메모</p>
            <Textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="관심 이유, 진입 조건..." className="h-16 text-sm resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={!form.ticker.trim() || !form.name.trim()}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ticker Card ───────────────────────────────────────────────────────────────

function TickerCard({ item, onEdit, onDelete }: {
  item: WatchlistItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasTarget = item.targetPrice != null && item.targetPrice > 0;
  const upside = hasTarget && item.currentPrice > 0
    ? ((item.targetPrice! - item.currentPrice) / item.currentPrice) * 100
    : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-background hover:bg-accent/30 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold">{item.ticker}</span>
          <span className="text-xs text-muted-foreground truncate">{item.name}</span>
          <Badge variant="outline" className="text-xs h-4 px-1.5">{item.market}</Badge>
          {item.sector && item.sector !== "other" && (
            <span className="text-xs text-muted-foreground">{SECTOR_LABELS[item.sector]}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          {item.currentPrice > 0 && (
            <span>{item.currentPrice.toLocaleString()} {item.currency === "KRW" ? "원" : "USD"}</span>
          )}
          {hasTarget && upside !== null && (
            <span className={upside >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
              목표 {item.targetPrice!.toLocaleString()} ({upside >= 0 ? "+" : ""}{upside.toFixed(1)}%)
            </span>
          )}
          {item.memo && <span className="truncate max-w-40">{item.memo}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Link href={`/portfolio/chart?ticker=${item.ticker}&market=${item.market}`}>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="차트 보기">
            <BarChart2 className="w-3.5 h-3.5" />
          </Button>
        </Link>
        <Link href={`/portfolio/news?ticker=${item.ticker}`}>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="뉴스 분석">
            <Newspaper className="w-3.5 h-3.5" />
          </Button>
        </Link>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WatchlistGroup | undefined>();

  const [tickerDialogOpen, setTickerDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WatchlistItem | undefined>();
  const [defaultGroupId, setDefaultGroupId] = useState<string>("");

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch("/api/portfolio/watchlist");
    if (res.ok) {
      const data = await res.json();
      const allGroups: WatchlistGroup[] = data.groups ?? [];
      const allItems: WatchlistItem[] = [
        ...allGroups.flatMap((g: WatchlistGroup) => (g.items ?? []).map((i: WatchlistItem) => ({ ...i, groupId: g.id }))),
        ...(data.ungroupedItems ?? []),
      ];
      setGroups(allGroups);
      setItems(allItems);
    }
  }

  async function handleSaveGroup(g: WatchlistGroup) {
    if (g.id) {
      await fetch(`/api/portfolio/watchlist/groups/${g.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g),
      });
    } else {
      const res = await fetch("/api/portfolio/watchlist/groups", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g),
      });
      if (!res.ok) { toast.error("그룹 저장 실패"); return; }
    }
    load();
  }

  async function handleDeleteGroup(id: string) {
    await fetch(`/api/portfolio/watchlist/groups/${id}`, { method: "DELETE" });
    load();
  }

  async function handleSaveItem(item: WatchlistItem) {
    if (item.id) {
      await fetch(`/api/portfolio/watchlist/items/${item.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item),
      });
    } else {
      const res = await fetch("/api/portfolio/watchlist/items", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item),
      });
      if (!res.ok) { toast.error("종목 저장 실패"); return; }
    }
    load();
  }

  async function handleDeleteItem(id: string) {
    await fetch(`/api/portfolio/watchlist/items/${id}`, { method: "DELETE" });
    setItems(i => i.filter(x => x.id !== id));
  }

  function openAddTicker(groupId?: string) {
    setEditingItem(undefined);
    setDefaultGroupId(groupId ?? "");
    setTickerDialogOpen(true);
  }

  function openEditTicker(item: WatchlistItem) {
    setEditingItem(item);
    setTickerDialogOpen(true);
  }

  function toggleCollapse(id: string) {
    setCollapsed(c => ({ ...c, [id]: !c[id] }));
  }

  const ungrouped = items.filter(i => !i.groupId);
  const totalItems = items.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">관심 종목</h1>
          <p className="text-sm text-muted-foreground mt-0.5">테마별로 관심 종목을 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingGroup(undefined); setGroupDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" />그룹 추가
          </Button>
          <Button size="sm" onClick={() => openAddTicker()}>
            <Plus className="w-3.5 h-3.5 mr-1" />종목 추가
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>총 <strong className="text-foreground">{totalItems}</strong>개 종목</span>
        <span>그룹 <strong className="text-foreground">{groups.length}</strong>개</span>
        {ungrouped.length > 0 && <span>미분류 {ungrouped.length}개</span>}
      </div>

      {/* Groups */}
      {groups.length === 0 && items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <Star className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-1">관심 종목이 없습니다</p>
            <p className="text-xs text-muted-foreground mb-4">그룹을 만들어 테마별로 정리해보세요<br />예: 코인주, 양자주, 2차전지, AI 관련주</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => { setEditingGroup(undefined); setGroupDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1" />그룹 만들기
              </Button>
              <Button size="sm" onClick={() => openAddTicker()}>
                <Plus className="w-3.5 h-3.5 mr-1" />종목 추가
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(group => {
            const groupItems = items.filter(i => i.groupId === group.id);
            const style = getColorStyle(group.color);
            const isCollapsed = collapsed[group.id];

            return (
              <Card key={group.id} className={`border ${style.border}`}>
                <CardHeader className="p-0">
                  <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${style.bg}`}>
                    <button
                      type="button"
                      className="flex items-center gap-2 flex-1 text-left"
                      onClick={() => toggleCollapse(group.id)}
                    >
                      <span className="text-lg">{group.emoji}</span>
                      <div>
                        <span className={`font-semibold text-sm ${style.text}`}>{group.name}</span>
                        {group.description && (
                          <span className="text-xs text-muted-foreground ml-2">{group.description}</span>
                        )}
                      </div>
                      <Badge variant="outline" className={`ml-1 text-xs h-5 ${style.text} ${style.border}`}>
                        {groupItems.length}
                      </Badge>
                      {isCollapsed
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
                        : <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" />
                      }
                    </button>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm" className={`h-7 text-xs gap-1 ${style.text}`}
                        onClick={() => openAddTicker(group.id)}
                      >
                        <Plus className="w-3 h-3" />종목
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingGroup(group); setGroupDialogOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGroup(group.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {!isCollapsed && (
                  <CardContent className="p-2 space-y-1">
                    {groupItems.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-xs text-muted-foreground mb-2">종목이 없습니다</p>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openAddTicker(group.id)}>
                          <Plus className="w-3 h-3 mr-1" />종목 추가
                        </Button>
                      </div>
                    ) : (
                      groupItems.map(item => (
                        <TickerCard
                          key={item.id}
                          item={item}
                          onEdit={() => openEditTicker(item)}
                          onDelete={() => handleDeleteItem(item.id)}
                        />
                      ))
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Ungrouped */}
          {ungrouped.length > 0 && (
            <Card>
              <CardHeader className="p-0">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-t-xl">
                  <button
                    type="button"
                    className="flex items-center gap-2 flex-1 text-left"
                    onClick={() => toggleCollapse("__ungrouped__")}
                  >
                    <span className="text-lg">📋</span>
                    <span className="font-semibold text-sm text-muted-foreground">미분류</span>
                    <Badge variant="outline" className="ml-1 text-xs h-5">{ungrouped.length}</Badge>
                    {collapsed["__ungrouped__"]
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
                      : <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" />
                    }
                  </button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openAddTicker()}>
                    <Plus className="w-3 h-3" />종목
                  </Button>
                </div>
              </CardHeader>
              {!collapsed["__ungrouped__"] && (
                <CardContent className="p-2 space-y-1">
                  {ungrouped.map(item => (
                    <TickerCard
                      key={item.id}
                      item={item}
                      onEdit={() => openEditTicker(item)}
                      onDelete={() => handleDeleteItem(item.id)}
                    />
                  ))}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Dialogs */}
      <GroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        initial={editingGroup}
        onSave={handleSaveGroup}
      />
      <TickerDialog
        open={tickerDialogOpen}
        onClose={() => setTickerDialogOpen(false)}
        initial={editingItem}
        groups={groups}
        defaultGroupId={defaultGroupId}
        onSave={handleSaveItem}
      />
    </div>
  );
}
