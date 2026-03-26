"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ChevronLeft, Check, X, Globe, Lock, Loader2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CourseMapItem } from "@/components/course/CourseMap";
import DayTabBar from "@/components/course/DayTabBar";
import CourseTimeline, { type TimelineItem } from "@/components/course/CourseTimeline";
import AddPlaceSheet from "@/components/course/AddPlaceSheet";

const CourseMap = dynamic(() => import("@/components/course/CourseMap"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────

interface Course {
  id: string; title: string; description: string | null;
  theme: string; tags: string[]; isPublic: boolean;
  totalDays: number;
  items: TimelineItem[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const THEMES: Record<string, string> = {
  date:    "💑 데이트",
  family:  "👨‍👩‍👧 가족",
  friends: "👥 친구",
  solo:    "🚶 혼자",
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Day 탭
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [addingDay, setAddingDay] = useState(false);

  // 지도 선택
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 제목 인라인 편집
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // AddPlaceSheet
  const [addSheet, setAddSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
  const [defaultSheetDay, setDefaultSheetDay] = useState(1);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/course/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.course) {
          setCourse(d.course);
          setItems(d.course.items ?? []);
        }
      })
      .catch(() => toast.error("코스를 불러올 수 없어요"))
      .finally(() => setLoading(false));
  }, [id]);

  // ── 파생 상태 ──────────────────────────────────────────────────────────────
  const visibleItems = useMemo(() =>
    selectedDay === null ? items : items.filter(it => it.day === selectedDay),
    [items, selectedDay]
  );

  const mapItems: CourseMapItem[] = useMemo(() =>
    visibleItems
      .filter(it => it.lat && it.lng)
      .map(it => ({ id: it.id, order: it.order, day: it.day, placeName: it.placeName, lat: it.lat!, lng: it.lng! })),
    [visibleItems]
  );

  const daySummaries = useMemo(() => {
    const map = new Map<number, { count: number; duration: number }>();
    const total = course?.totalDays ?? 1;
    for (let d = 1; d <= total; d++) {
      const dayItems = items.filter(it => it.day === d);
      map.set(d, {
        count: dayItems.length,
        duration: dayItems.reduce((s, it) => s + (it.duration ?? 0), 0),
      });
    }
    return map;
  }, [items, course?.totalDays]);

  // ── 제목 저장 ──────────────────────────────────────────────────────────────
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

  // ── 일차 추가 ─────────────────────────────────────────────────────────────
  async function handleAddDay() {
    if (!course || addingDay) return;
    setAddingDay(true);
    try {
      const newTotal = course.totalDays + 1;
      const res = await fetch(`/api/course/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalDays: newTotal }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error("일차 추가 실패"); return; }
      setCourse(c => c ? { ...c, totalDays: data.course.totalDays } : c);
      setSelectedDay(newTotal);
      toast.success(`${newTotal}일차가 추가됐어요`);
    } finally { setAddingDay(false); }
  }

  // ── 장소 삭제 ─────────────────────────────────────────────────────────────
  async function handleDeleteItem(itemId: string) {
    if (!confirm("이 장소를 코스에서 제거할까요?")) return;
    await fetch(`/api/course/${id}/items/${itemId}`, { method: "DELETE" });
    setItems(prev => prev.filter(it => it.id !== itemId));
    toast.success("제거됐어요");
  }

  // ── 장소 편집 열기 ─────────────────────────────────────────────────────────
  function openEditItem(item: TimelineItem) {
    setEditingItem(item);
    setAddSheet(true);
  }

  // ── 장소 추가 열기 ─────────────────────────────────────────────────────────
  function openAddItem(day: number) {
    setEditingItem(null);
    setDefaultSheetDay(day);
    setAddSheet(true);
  }

  // ── Sheet 닫기 ─────────────────────────────────────────────────────────────
  function closeAddSheet() {
    setAddSheet(false);
    setEditingItem(null);
  }

  // ── 저장 콜백 ─────────────────────────────────────────────────────────────
  const handleItemSaved = useCallback((savedItem: TimelineItem, isEdit: boolean) => {
    if (isEdit) {
      setItems(prev => prev.map(it => it.id === savedItem.id ? savedItem : it));
    } else {
      setItems(prev => [...prev, savedItem]);
      // 저장된 day로 탭 자동 이동
      setSelectedDay(savedItem.day);
    }
  }, []);

  // ── 드래그 reorder ────────────────────────────────────────────────────────
  const handleReorder = useCallback((reordered: TimelineItem[]) => {
    // reordered는 해당 day의 새 순서 (order가 재계산됨)
    setItems(prev => {
      const targetDay = reordered[0]?.day;
      if (!targetDay) return prev;
      const otherDays = prev.filter(it => it.day !== targetDay);
      return [...otherDays, ...reordered].sort((a, b) =>
        a.day !== b.day ? a.day - b.day : a.order - b.order
      );
    });
    // 서버에 order 동기화
    Promise.all(reordered.map(it =>
      fetch(`/api/course/${id}/items/${it.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: it.order }),
      })
    ));
  }, [id]);

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!course) return <div className="text-center py-20 text-muted-foreground">코스를 찾을 수 없어요</div>;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* ── 헤더 ── */}
      <div className="flex items-start gap-3 mb-4">
        <Button variant="ghost" size="sm" className="gap-1 px-2 shrink-0 mt-0.5"
          onClick={() => router.push("/course")}>
          <ChevronLeft className="w-4 h-4" />목록
        </Button>
        <div className="flex-1 min-w-0">
          {/* 제목 */}
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <Input value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                className="h-8 text-base font-bold" autoFocus />
              <button onClick={saveTitle} className="p-1 hover:text-primary"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditingTitle(false)} className="p-1 hover:text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-lg font-bold truncate">{course.title}</h1>
              <button
                onClick={() => { setTitleDraft(course.title); setEditingTitle(true); }}
                className="p-1 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity shrink-0">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {/* 메타 */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">
              {THEMES[course.theme] ?? course.theme}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground">{course.totalDays}일 코스</span>
            {course.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] h-4 px-1.5">{tag}</Badge>
            ))}
          </div>
        </div>
        {/* 공개/비공개 토글 */}
        <button onClick={togglePublic}
          className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
          title={course.isPublic ? "공개 중 (클릭하여 비공개)" : "비공개 (클릭하여 공개)"}>
          {course.isPublic
            ? <Globe className="w-4 h-4 text-primary" />
            : <Lock className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>

      {/* ── 일차 탭 바 ── */}
      <div className="mb-4">
        <DayTabBar
          totalDays={course.totalDays}
          selectedDay={selectedDay}
          daySummaries={daySummaries}
          onSelectDay={setSelectedDay}
          onAddDay={handleAddDay}
          addingDay={addingDay}
        />
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* 왼쪽: 타임라인 */}
        <div className="w-full lg:w-[420px] shrink-0 overflow-y-auto lg:max-h-[calc(100vh-200px)]">
          <CourseTimeline
            items={visibleItems}
            day={selectedDay}
            totalDays={course.totalDays}
            onEditItem={openEditItem}
            onDeleteItem={handleDeleteItem}
            onAddItem={openAddItem}
            onReorder={handleReorder}
            selectedId={selectedId}
            onSelectId={setSelectedId}
          />
        </div>

        {/* 오른쪽: 지도 */}
        <div className="flex-1 h-[360px] lg:h-auto lg:min-h-[500px] lg:sticky lg:top-4 lg:max-h-[calc(100vh-200px)] rounded-xl overflow-hidden border">
          <CourseMap
            items={mapItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
            dayFilter={selectedDay}
          />
        </div>
      </div>

      {/* ── 장소 추가/편집 Sheet ── */}
      <AddPlaceSheet
        open={addSheet}
        onClose={closeAddSheet}
        courseId={id}
        totalDays={course.totalDays}
        defaultDay={defaultSheetDay}
        editingItem={editingItem}
        onSaved={handleItemSaved}
      />
    </div>
  );
}
