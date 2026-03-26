"use client";

import { Loader2, Plus } from "lucide-react";

interface DaySummary { count: number; duration: number; }

interface Props {
  totalDays: number;
  selectedDay: number | null;
  daySummaries: Map<number, DaySummary>;
  onSelectDay: (day: number | null) => void;
  onAddDay: () => void;
  addingDay: boolean;
}

export default function DayTabBar({ totalDays, selectedDay, daySummaries, onSelectDay, onAddDay, addingDay }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {/* 전체 탭 */}
      <button
        onClick={() => onSelectDay(null)}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
          ${selectedDay === null
            ? "bg-indigo-500 text-white border-indigo-500 shadow-sm"
            : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"}`}
      >
        전체
      </button>

      {/* 일차별 탭 */}
      {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
        const summary = daySummaries.get(d);
        const isActive = selectedDay === d;
        return (
          <button
            key={d}
            onClick={() => onSelectDay(d)}
            className={`shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
              ${isActive
                ? "bg-indigo-500 text-white border-indigo-500 shadow-sm"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <span>{d}일차</span>
            {summary && summary.count > 0 && (
              <span className={`text-[10px] font-normal ${isActive ? "text-indigo-100" : "text-muted-foreground"}`}>
                {summary.count}곳
              </span>
            )}
          </button>
        );
      })}

      {/* 일차 추가 버튼 */}
      {totalDays < 30 && (
        <button
          onClick={onAddDay}
          disabled={addingDay}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-indigo-300 hover:text-indigo-500 transition-all disabled:opacity-50"
        >
          {addingDay ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          일차 추가
        </button>
      )}
    </div>
  );
}
