"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ChevronLeft, Plus, Trash2, Pencil, GripVertical,
  Clock, MapPin, Loader2, Check, X, Globe, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { CourseMapItem } from "@/components/course/CourseMap";

const CourseMap = dynamic(() => import("@/components/course/CourseMap"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────

interface RestaurantRef { id: string; name: string; category: string; avgRating: number; }

interface CourseItem {
  id: string; courseId: string; order: number;
  restaurantId: string | null; restaurant: RestaurantRef | null;
  placeName: string; placeAddress: string;
  lat: number | null; lng: number | null;
  plannedTime: string | null; duration: number | null; note: string | null;
}

interface Course {
  id: string; title: string; description: string | null;
  theme: string; tags: string[]; isPublic: boolean;
  items: CourseItem[];
}

interface MyRestaurant {
  id: string; name: string; category: string; address: string;
  latitude: number | null; longitude: number | null; avgRating: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const THEMES = [
  { key: "date",    label: "💑 데이트" },
  { key: "family",  label: "👨‍👩‍👧 가족" },
  { key: "friends", label: "👥 친구" },
  { key: "solo",    label: "🚶 혼자" },
];

const EMPTY_ITEM_FORM = {
  restaurantId: "", placeName: "", placeAddress: "",
  lat: "", lng: "", plannedTime: "", duration: "", note: "",
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [items, setItems] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 제목 인라인 편집
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // 장소 추가/편집 시트
  const [addSheet, setAddSheet] = useState(false);
  const [addTab, setAddTab] = useState<"restaurant" | "manual">("restaurant");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [savingItem, setSavingItem] = useState(false);

  // 내 맛집 탭
  const [myRestaurants, setMyRestaurants] = useState<MyRestaurant[]>([]);
  const [restSearch, setRestSearch] = useState("");
  const [restLoading, setRestLoading] = useState(false);

  // 드래그 순서 변경
  const draggedIdx = useRef<number | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/course/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.course) { setCourse(d.course); setItems(d.course.items ?? []); }
      })
      .catch(() => toast.error("코스를 불러올 수 없어요"))
      .finally(() => setLoading(false));
  }, [id]);

  const loadMyRestaurants = useCallback(() => {
    if (myRestaurants.length > 0) return;
    setRestLoading(true);
    fetch("/api/restaurant?limit=500")
      .then(r => r.json())
      .then(d => setMyRestaurants(d.restaurants ?? []))
      .catch(() => {})
      .finally(() => setRestLoading(false));
  }, [myRestaurants.length]);

  useEffect(() => {
    if (addSheet && addTab === "restaurant") loadMyRestaurants();
  }, [addSheet, addTab, loadMyRestaurants]);

  // ── 제목 편집 저장 ─────────────────────────────────────────────────────────
  async function saveTitle() {
    if (!titleDraft.trim() || titleDraft === course?.title) { setEditingTitle(false); return; }
    await fetch(`/api/course/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft }),
    });
    setCourse(c => c ? { ...c, title: titleDraft } : c);
    setEditingTitle(false);
  }

  // ── 공개/비공개 토글 ──────────────────────────────────────────────────────
  async function togglePublic() {
    if (!course) return;
    const next = !course.isPublic;
    await fetch(`/api/course/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });
    setCourse(c => c ? { ...c, isPublic: next } : c);
    toast.success(next ? "공개로 변경됐어요" : "비공개로 변경됐어요");
  }

  // ── 장소 저장 (추가 / 편집) ───────────────────────────────────────────────
  async function saveItem() {
    if (!itemForm.placeName.trim()) { toast.error("장소명을 입력해주세요"); return; }
    if (!itemForm.placeAddress.trim()) { toast.error("주소를 입력해주세요"); return; }
    setSavingItem(true);
    try {
      const body = {
        restaurantId: itemForm.restaurantId || null,
        placeName: itemForm.placeName,
        placeAddress: itemForm.placeAddress,
        lat: itemForm.lat ? parseFloat(itemForm.lat) : null,
        lng: itemForm.lng ? parseFloat(itemForm.lng) : null,
        plannedTime: itemForm.plannedTime || null,
        duration: itemForm.duration ? parseInt(itemForm.duration) : null,
        note: itemForm.note || null,
      };

      if (editingItemId) {
        const res = await fetch(`/api/course/${id}/items/${editingItemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setItems(prev => prev.map(it => it.id === editingItemId ? { ...it, ...data.item } : it));
        toast.success("수정됐어요");
      } else {
        const res = await fetch(`/api/course/${id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setItems(prev => [...prev, data.item]);
        toast.success("장소가 추가됐어요");
      }
      closeAddSheet();
    } catch { toast.error("저장 실패"); }
    finally { setSavingItem(false); }
  }

  // ── 장소 삭제 ─────────────────────────────────────────────────────────────
  async function deleteItem(itemId: string) {
    if (!confirm("이 장소를 코스에서 제거할까요?")) return;
    await fetch(`/api/course/${id}/items/${itemId}`, { method: "DELETE" });
    setItems(prev => prev.filter(it => it.id !== itemId).map((it, i) => ({ ...it, order: i })));
    toast.success("제거됐어요");
  }

  // ── 편집 시트 열기 ─────────────────────────────────────────────────────────
  function openEditItem(item: CourseItem) {
    setEditingItemId(item.id);
    setItemForm({
      restaurantId: item.restaurantId ?? "",
      placeName: item.placeName,
      placeAddress: item.placeAddress,
      lat: item.lat?.toString() ?? "",
      lng: item.lng?.toString() ?? "",
      plannedTime: item.plannedTime ?? "",
      duration: item.duration?.toString() ?? "",
      note: item.note ?? "",
    });
    setAddSheet(true);
  }

  function closeAddSheet() {
    setAddSheet(false);
    setEditingItemId(null);
    setItemForm(EMPTY_ITEM_FORM);
    setRestSearch("");
  }

  // 맛집에서 선택 시 폼 자동 채우기
  function selectRestaurant(r: MyRestaurant) {
    setItemForm(f => ({
      ...f,
      restaurantId: r.id,
      placeName: r.name,
      placeAddress: r.address,
      lat: r.latitude?.toString() ?? "",
      lng: r.longitude?.toString() ?? "",
    }));
    setAddTab("manual"); // 상세 입력으로 이동
  }

  // ── 드래그 & 드롭 순서 변경 ────────────────────────────────────────────────
  function onDragStart(idx: number) { draggedIdx.current = idx; }

  function onDragOver(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const from = draggedIdx.current;
    if (from === null || from === targetIdx) return;
    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(targetIdx, 0, moved);
    const withOrder = reordered.map((it, i) => ({ ...it, order: i }));
    setItems(withOrder);
    draggedIdx.current = targetIdx;
  }

  async function onDragEnd() {
    draggedIdx.current = null;
    // 변경된 순서 서버에 반영
    await Promise.all(items.map(it =>
      fetch(`/api/course/${id}/items/${it.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: it.order }),
      })
    ));
  }

  // ── 지도용 아이템 변환 ─────────────────────────────────────────────────────
  const mapItems: CourseMapItem[] = items
    .filter(it => it.lat && it.lng)
    .map(it => ({ id: it.id, order: it.order, placeName: it.placeName, lat: it.lat!, lng: it.lng! }));

  const totalDuration = items.reduce((s, it) => s + (it.duration ?? 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!course) return <div className="text-center py-20 text-muted-foreground">코스를 찾을 수 없어요</div>;

  const themeInfo = THEMES.find(t => t.key === course.theme) ?? THEMES[0];

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={() => router.push("/course")}>
          <ChevronLeft className="w-4 h-4" />목록
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* ── 왼쪽: 코스 정보 + 아이템 목록 ── */}
        <div className="w-full md:w-[420px] shrink-0 space-y-3">
          {/* 코스 메타 */}
          <Card>
            <CardContent className="p-4 space-y-2">
              {/* 제목 */}
              <div className="flex items-center gap-2">
                {editingTitle ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <Input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                      className="h-8 text-sm font-semibold" autoFocus />
                    <button onClick={saveTitle} className="p-1 hover:text-primary"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingTitle(false)} className="p-1 hover:text-muted-foreground"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 group">
                    <h2 className="font-bold text-base flex-1">{course.title}</h2>
                    <button onClick={() => { setTitleDraft(course.title); setEditingTitle(true); }}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button onClick={togglePublic}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
                  title={course.isPublic ? "공개 중" : "비공개"}>
                  {course.isPublic ? <Globe className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-medium">
                  {themeInfo.label}
                </span>
                {course.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5">{tag}</Badge>
                ))}
              </div>

              {course.description && (
                <p className="text-xs text-muted-foreground">{course.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{items.length}개 장소</span>
                {totalDuration > 0 && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />총 {totalDuration}분</span>}
              </div>
            </CardContent>
          </Card>

          {/* 장소 목록 */}
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <div key={item.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all group
                  ${item.id === selectedId ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/20" : "border-border bg-card hover:border-indigo-200"}`}>
                {/* 드래그 핸들 */}
                <div className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground shrink-0">
                  <GripVertical className="w-4 h-4" />
                </div>
                {/* 순서 번호 */}
                <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {item.order + 1}
                </div>
                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug">{item.placeName}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.placeAddress}</p>
                  {(item.plannedTime || item.duration) && (
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      {item.plannedTime && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{item.plannedTime}</span>}
                      {item.duration && <span>{item.duration}분</span>}
                    </div>
                  )}
                  {item.note && <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">{item.note}</p>}
                  {item.restaurant && (
                    <span className="text-[10px] text-indigo-500 font-medium">{item.restaurant.category} · ★{item.restaurant.avgRating.toFixed(1)}</span>
                  )}
                </div>
                {/* 액션 */}
                <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); openEditItem(item); }}
                    className="p-1 hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                    className="p-1 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}

            {/* 장소 추가 버튼 */}
            <button onClick={() => { setEditingItemId(null); setItemForm(EMPTY_ITEM_FORM); setAddSheet(true); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-indigo-300 text-muted-foreground hover:text-indigo-500 text-sm transition-all">
              <Plus className="w-4 h-4" />장소 추가
            </button>
          </div>
        </div>

        {/* ── 오른쪽: 지도 ── */}
        <div className="flex-1 h-[400px] md:h-auto md:min-h-[500px] rounded-xl overflow-hidden border">
          <CourseMap items={mapItems} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      {/* ── 장소 추가/편집 시트 ── */}
      {addSheet && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={closeAddSheet}>
          <div className="w-full max-w-lg mx-auto bg-background rounded-t-2xl shadow-2xl border-t p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{editingItemId ? "장소 편집" : "장소 추가"}</p>
              <button onClick={closeAddSheet}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            {/* 탭 (추가 모드만) */}
            {!editingItemId && (
              <div className="flex gap-1 bg-muted/50 rounded-xl p-1 text-xs">
                {(["restaurant", "manual"] as const).map(tab => (
                  <button key={tab} onClick={() => setAddTab(tab)}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-all
                      ${addTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                    {tab === "restaurant" ? "🍽️ 내 맛집에서" : "✏️ 직접 입력"}
                  </button>
                ))}
              </div>
            )}

            {/* 내 맛집 탭 */}
            {addTab === "restaurant" && !editingItemId && (
              <div className="space-y-2">
                <Input placeholder="맛집 검색..." value={restSearch}
                  onChange={e => setRestSearch(e.target.value)} className="h-8 text-sm" />
                {restLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {myRestaurants
                      .filter(r => !restSearch || r.name.includes(restSearch) || r.address.includes(restSearch))
                      .map(r => (
                        <button key={r.id} onClick={() => selectRestaurant(r)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/60 text-left transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.category} · {r.address}</p>
                          </div>
                          {r.avgRating > 0 && <span className="text-xs text-amber-500 shrink-0">★{r.avgRating.toFixed(1)}</span>}
                        </button>
                      ))}
                    {myRestaurants.length === 0 && !restLoading && (
                      <p className="text-xs text-muted-foreground text-center py-3">저장한 맛집이 없어요</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 직접 입력 탭 */}
            {(addTab === "manual" || editingItemId) && (
              <div className="space-y-2.5">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">장소명 *</p>
                  <Input value={itemForm.placeName}
                    onChange={e => setItemForm(f => ({ ...f, placeName: e.target.value }))}
                    placeholder="예: 경복궁" className="h-9 text-sm" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">주소 *</p>
                  <Input value={itemForm.placeAddress}
                    onChange={e => setItemForm(f => ({ ...f, placeAddress: e.target.value }))}
                    placeholder="예: 서울 종로구 사직로 161" className="h-9 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">방문 예정 시간</p>
                    <Input type="time" value={itemForm.plannedTime}
                      onChange={e => setItemForm(f => ({ ...f, plannedTime: e.target.value }))}
                      className="h-9 text-sm" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">소요 시간 (분)</p>
                    <Input type="number" min="0" placeholder="60" value={itemForm.duration}
                      onChange={e => setItemForm(f => ({ ...f, duration: e.target.value }))}
                      className="h-9 text-sm" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">메모 (선택)</p>
                  <Textarea value={itemForm.note}
                    onChange={e => setItemForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="예약 필요, 주차 가능 등..." className="h-16 text-sm resize-none" />
                </div>
              </div>
            )}

            {/* 저장 버튼 (직접입력 탭 또는 편집 모드) */}
            {(addTab === "manual" || editingItemId) && (
              <Button className="w-full h-9" onClick={saveItem} disabled={savingItem}>
                {savingItem ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editingItemId ? "수정" : "추가"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
