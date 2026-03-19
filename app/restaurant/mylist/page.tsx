"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Star, MapPin, Trash2, Plus, Pencil, Check, X, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

const EMOJI_OPTIONS = ["🍽️","🍜","🍣","🍕","☕","🥩","🍱","🍔","🌮","🍷","🍺","🎉","❤️","⭐","📌","🗂️"];
const COLOR_OPTIONS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6","#f97316","#64748b"];

interface RestaurantList {
  id: string;
  name: string;
  emoji: string;
  color: string;
  sortOrder: number;
  itemCount: number;
}

interface ListItem {
  id: string;
  memo: string | null;
  addedAt: string;
  restaurant: {
    id: string;
    name: string;
    category: string;
    address: string;
    avgRating: number;
    reviewCount: number;
    url: string | null;
  };
}

const SORT_OPTIONS = [
  { value: "latest", label: "최신 추가" },
  { value: "rating", label: "별점순" },
  { value: "name", label: "이름순" },
] as const;
type SortOption = typeof SORT_OPTIONS[number]["value"];

export default function MyListPage() {
  const [lists, setLists] = useState<RestaurantList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [sort, setSort] = useState<SortOption>("latest");

  // 리스트 생성/편집 Sheet
  const [editSheet, setEditSheet] = useState(false);
  const [editingList, setEditingList] = useState<RestaurantList | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("🍽️");
  const [draftColor, setDraftColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<RestaurantList | null>(null);

  const fetchLists = useCallback(async () => {
    setLoadingLists(true);
    const res = await fetch("/api/restaurant/lists");
    if (res.ok) {
      const data: RestaurantList[] = await res.json();
      setLists(data);
      // 첫 진입 시 첫 번째 리스트 자동 선택
      if (data.length > 0 && activeListId === null) {
        setActiveListId(data[0].id);
      }
    }
    setLoadingLists(false);
  }, [activeListId]);

  const fetchItems = useCallback(async (listId: string) => {
    setLoadingItems(true);
    const res = await fetch(`/api/restaurant/lists/${listId}/items?limit=200`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
    setLoadingItems(false);
  }, []);

  useEffect(() => { fetchLists(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeListId) fetchItems(activeListId);
    else setItems([]);
  }, [activeListId, fetchItems]);

  const displayedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sort === "rating") return b.restaurant.avgRating - a.restaurant.avgRating;
      if (sort === "name") return a.restaurant.name.localeCompare(b.restaurant.name, "ko");
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }, [items, sort]);

  function openCreateSheet() {
    setEditingList(null);
    setDraftName("");
    setDraftEmoji("🍽️");
    setDraftColor("#6366f1");
    setEditSheet(true);
  }

  function openEditSheet(list: RestaurantList, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingList(list);
    setDraftName(list.name);
    setDraftEmoji(list.emoji);
    setDraftColor(list.color);
    setEditSheet(true);
  }

  async function saveList() {
    if (!draftName.trim()) { toast.error("리스트 이름을 입력해주세요"); return; }
    setSaving(true);
    try {
      if (editingList) {
        const res = await fetch(`/api/restaurant/lists/${editingList.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: draftName, emoji: draftEmoji, color: draftColor }),
        });
        if (!res.ok) { toast.error("수정 실패"); return; }
        toast.success("리스트가 수정되었습니다");
      } else {
        const res = await fetch("/api/restaurant/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: draftName, emoji: draftEmoji, color: draftColor }),
        });
        if (!res.ok) { toast.error("생성 실패"); return; }
        const created: RestaurantList = await res.json();
        setActiveListId(created.id);
        toast.success("리스트가 생성되었습니다");
      }
      setEditSheet(false);
      await fetchLists();
    } finally {
      setSaving(false);
    }
  }

  async function deleteList(list: RestaurantList) {
    const res = await fetch(`/api/restaurant/lists/${list.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    toast.success(`"${list.name}" 리스트가 삭제되었습니다`);
    setDeleteTarget(null);
    // 다음 리스트로 이동
    const remaining = lists.filter(l => l.id !== list.id);
    setActiveListId(remaining[0]?.id ?? null);
    await fetchLists();
  }

  async function removeFromList(item: ListItem) {
    if (!activeListId) return;
    const res = await fetch(`/api/restaurant/lists/${activeListId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: item.restaurant.id }),
    });
    if (!res.ok) { toast.error("제거 실패"); return; }
    toast.success("리스트에서 제거했습니다");
    fetchItems(activeListId);
    fetchLists();
  }

  const activeList = lists.find(l => l.id === activeListId);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">내 맛집 리스트</h1>
        <div className="flex gap-2">
          <Link href="/restaurant">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <MapPin className="w-3.5 h-3.5" />맛집 탐색
            </Button>
          </Link>
          <Button size="sm" onClick={openCreateSheet} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />새 리스트
          </Button>
        </div>
      </div>

      {loadingLists ? (
        <div className="text-center py-16 text-muted-foreground text-sm">불러오는 중...</div>
      ) : lists.length === 0 ? (
        /* 빈 상태 */
        <div className="text-center py-20 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">아직 리스트가 없어요</p>
          <p className="text-sm mb-4">가고 싶은 곳, 다녀온 곳 등 나만의 리스트를 만들어보세요</p>
          <Button size="sm" onClick={openCreateSheet} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />첫 리스트 만들기
          </Button>
        </div>
      ) : (
        <>
          {/* 리스트 탭 */}
          <div className="flex gap-2 flex-wrap">
            {lists.map(list => (
              <button
                key={list.id}
                onClick={() => setActiveListId(list.id)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                  activeListId === list.id
                    ? "text-white border-transparent shadow-sm"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                }`}
                style={activeListId === list.id ? { backgroundColor: list.color, borderColor: list.color } : {}}
              >
                <span>{list.emoji}</span>
                <span className="font-medium">{list.name}</span>
                <span className={`text-[11px] px-1 rounded-full ${
                  activeListId === list.id ? "bg-white/20" : "bg-muted"
                }`}>
                  {list.itemCount}
                </span>
              </button>
            ))}
          </div>

          {/* 선택된 리스트 헤더 */}
          {activeList && (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{activeList.emoji}</span>
                <h2 className="font-semibold">{activeList.name}</h2>
                <span className="text-xs text-muted-foreground">({activeList.itemCount}개)</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => openEditSheet(activeList, e)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="리스트 편집"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(activeList)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                  title="리스트 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 정렬 */}
          {items.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">정렬:</span>
              {SORT_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSort(s.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    sort === s.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* 맛집 목록 */}
          {loadingItems ? (
            <div className="text-center py-12 text-muted-foreground text-sm">불러오는 중...</div>
          ) : displayedItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="text-sm mb-3">이 리스트에 아직 맛집이 없어요</p>
              <Link href="/restaurant">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />맛집 추가하러 가기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedItems.map(item => (
                <Card key={item.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/restaurant/${item.restaurant.id}`} className="flex-1 min-w-0 group">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] shrink-0">{item.restaurant.category}</Badge>
                          <span className="font-semibold text-sm group-hover:underline truncate">
                            {item.restaurant.name}
                          </span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-48">{item.restaurant.address}</span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {item.restaurant.avgRating > 0 ? item.restaurant.avgRating.toFixed(1) : "-"}
                            <span className="text-muted-foreground/60">({item.restaurant.reviewCount})</span>
                          </span>
                        </div>
                        {item.memo && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{item.memo}"</p>
                        )}
                      </Link>
                      <button
                        onClick={() => removeFromList(item)}
                        className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-destructive shrink-0"
                        title="리스트에서 제거"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* 리스트 생성/편집 Sheet */}
      <Sheet open={editSheet} onOpenChange={setEditSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="pb-4">
            <SheetTitle>{editingList ? "리스트 편집" : "새 리스트 만들기"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-6">
            {/* 이름 */}
            <div>
              <p className="text-sm font-medium mb-1.5">리스트 이름</p>
              <Input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="예: 가고 싶은 곳, 회사 점심..."
                maxLength={20}
                autoFocus
              />
            </div>

            {/* 이모지 */}
            <div>
              <p className="text-sm font-medium mb-1.5">아이콘</p>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => setDraftEmoji(e)}
                    className={`w-9 h-9 text-lg rounded-lg border-2 transition-all ${
                      draftEmoji === e ? "border-primary scale-110" : "border-border hover:border-foreground/30"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* 색상 */}
            <div>
              <p className="text-sm font-medium mb-1.5">색상</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setDraftColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      draftColor === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {draftColor === c && <Check className="w-4 h-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* 미리보기 */}
            <div className="flex items-center gap-2 p-3 rounded-xl border bg-muted/30">
              <span className="text-sm text-muted-foreground">미리보기:</span>
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-medium"
                style={{ backgroundColor: draftColor }}
              >
                <span>{draftEmoji}</span>
                <span>{draftName || "리스트 이름"}</span>
              </div>
            </div>

            <Button onClick={saveList} disabled={saving || !draftName.trim()} className="w-full">
              {saving ? "저장 중..." : editingList ? "수정 완료" : "리스트 만들기"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 삭제 확인 Sheet */}
      <Sheet open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="pb-4">
            <SheetTitle>리스트 삭제</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-6">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span> 리스트를 삭제하면
              리스트 안의 맛집 기록이 모두 사라집니다. (맛집 자체는 삭제되지 않습니다)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>취소</Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => deleteTarget && deleteList(deleteTarget)}
              >
                삭제
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
