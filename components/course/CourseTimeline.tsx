"use client";

import { useRef } from "react";
import { Clock, GripVertical, MapPin, Pencil, Trash2 } from "lucide-react";
import { Plus } from "lucide-react";

interface RestaurantRef { id: string; name: string; category: string; avgRating: number; }

export interface TimelineItem {
  id: string;
  courseId: string;
  day: number;
  order: number;
  restaurantId: string | null;
  restaurant: RestaurantRef | null;
  placeName: string;
  placeAddress: string;
  lat: number | null;
  lng: number | null;
  plannedTime: string | null;
  duration: number | null;
  note: string | null;
  kakaoPlaceId: string | null;
}

interface Props {
  items: TimelineItem[];         // 이미 selectedDay로 필터된 아이템
  day: number | null;            // null = 전체보기
  totalDays: number;
  onEditItem: (item: TimelineItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: (day: number) => void;
  onReorder: (reordered: TimelineItem[]) => void;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
}

function PlaceCard({
  item, idx, isDraggable, isSelected,
  onEdit, onDelete, onSelect,
}: {
  item: TimelineItem; idx: number; isDraggable: boolean;
  isSelected: boolean;
  onEdit: () => void; onDelete: () => void; onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-all group
        ${isSelected
          ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/20"
          : "border-border bg-card hover:border-indigo-200 dark:hover:border-indigo-800"}`}
    >
      {isDraggable && (
        <div className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground shrink-0">
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      {/* 번호 dot */}
      <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
        {idx + 1}
      </div>
      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{item.placeName}</p>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-0.5">
          <MapPin className="w-3 h-3 shrink-0" />{item.placeAddress}
        </p>
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
        <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1 hover:text-primary rounded">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 hover:text-destructive rounded">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function DaySection({
  day, items, isDraggable, selectedId, onSelectId,
  onEditItem, onDeleteItem, onAddItem, onReorder,
}: {
  day: number; items: TimelineItem[]; isDraggable: boolean;
  selectedId: string | null; onSelectId: (id: string | null) => void;
  onEditItem: (item: TimelineItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: (day: number) => void;
  onReorder: (reordered: TimelineItem[]) => void;
}) {
  const draggedIdx = useRef<number | null>(null);
  const totalDuration = items.reduce((s, it) => s + (it.duration ?? 0), 0);
  const hours = Math.floor(totalDuration / 60);
  const mins = totalDuration % 60;

  function onDragStart(idx: number) { draggedIdx.current = idx; }
  function onDragOver(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const from = draggedIdx.current;
    if (from === null || from === targetIdx) return;
    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(targetIdx, 0, moved);
    draggedIdx.current = targetIdx;
    onReorder(reordered.map((it, i) => ({ ...it, order: i })));
  }
  function onDragEnd() { draggedIdx.current = null; }

  return (
    <div className="space-y-0">
      {/* Day 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {day}일차
        </span>
        {totalDuration > 0 && (
          <span className="text-[11px] text-muted-foreground">
            총 {hours > 0 ? `${hours}h ` : ""}{mins > 0 ? `${mins}m` : ""}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">장소가 없어요</p>
      ) : (
        <div className="relative">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex gap-2"
              draggable={isDraggable}
              onDragStart={() => onDragStart(idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDragEnd={onDragEnd}
            >
              {/* 시간 컬럼 */}
              <div className="w-11 pt-3 text-right shrink-0">
                {item.plannedTime && (
                  <span className="text-[11px] text-muted-foreground font-medium">{item.plannedTime}</span>
                )}
              </div>

              {/* 세로 연결선 */}
              <div className="flex flex-col items-center shrink-0 pt-3">
                <div className={`w-2 h-2 rounded-full border-2 shrink-0
                  ${item.id === selectedId ? "bg-indigo-500 border-indigo-500" : "bg-background border-indigo-400"}`} />
                {idx < items.length - 1 && (
                  <div className="w-0.5 flex-1 bg-indigo-200 dark:bg-indigo-800 min-h-[32px]" />
                )}
              </div>

              {/* 카드 */}
              <div className="flex-1 pb-3">
                <PlaceCard
                  item={item} idx={idx}
                  isDraggable={isDraggable}
                  isSelected={item.id === selectedId}
                  onEdit={() => onEditItem(item)}
                  onDelete={() => onDeleteItem(item.id)}
                  onSelect={() => onSelectId(item.id === selectedId ? null : item.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 장소 추가 버튼 */}
      <button
        onClick={() => onAddItem(day)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-indigo-300 text-muted-foreground hover:text-indigo-500 text-xs transition-all mt-1"
      >
        <Plus className="w-3.5 h-3.5" />{day}일차 장소 추가
      </button>
    </div>
  );
}

export default function CourseTimeline({
  items, day, totalDays, onEditItem, onDeleteItem, onAddItem,
  onReorder, selectedId, onSelectId,
}: Props) {
  // 전체 보기: 일차별 그룹
  if (day === null) {
    return (
      <div className="space-y-6">
        {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
          const dayItems = [...items.filter(it => it.day === d)].sort((a, b) => a.order - b.order);
          return (
            <div key={d}>
              <DaySection
                day={d} items={dayItems} isDraggable={false}
                selectedId={selectedId} onSelectId={onSelectId}
                onEditItem={onEditItem} onDeleteItem={onDeleteItem}
                onAddItem={onAddItem} onReorder={onReorder}
              />
              {d < totalDays && <div className="border-b border-dashed border-border mt-4" />}
            </div>
          );
        })}
      </div>
    );
  }

  // 특정 일차 보기
  const dayItems = [...items].sort((a, b) => a.order - b.order);
  return (
    <DaySection
      day={day} items={dayItems} isDraggable={true}
      selectedId={selectedId} onSelectId={onSelectId}
      onEditItem={onEditItem} onDeleteItem={onDeleteItem}
      onAddItem={onAddItem} onReorder={onReorder}
    />
  );
}
