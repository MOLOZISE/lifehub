"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { localDateStr } from "@/lib/utils-app";

interface DayData {
  date: string; // YYYY-MM-DD
  minutes: number;
}

interface StudyHeatmapProps {
  data: DayData[];
  weeks?: number;
}

function getIntensity(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes === 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

const INTENSITY_CLASSES = [
  "bg-muted",
  "bg-green-200 dark:bg-green-900",
  "bg-green-400 dark:bg-green-700",
  "bg-green-500 dark:bg-green-600",
  "bg-green-600 dark:bg-green-500",
];

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const CELL = 11;  // px
const GAP  = 3;   // px
const MONTH_ROW_H = 14; // px

export function StudyHeatmap({ data }: StudyHeatmapProps) {
  const { grid, months, weeks } = useMemo(() => {
    const dataMap = new Map(data.map((d) => [d.date, d.minutes]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3개월 전 1일부터 시작 → 월 레이블은 12월~3월 (4개월)
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 3);
    startDate.setDate(1);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // 일요일로 정렬

    const diffDays = Math.ceil((today.getTime() - startDate.getTime()) / 86400000);
    const weeks = Math.ceil(diffDays / 7) + 1;

    const columns: { date: string; minutes: number; isActive: boolean }[][] = [];
    const monthLabels: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;

    const current = new Date(startDate);
    for (let col = 0; col < weeks; col++) {
      const week: { date: string; minutes: number; isActive: boolean }[] = [];
      for (let row = 0; row < 7; row++) {
        const dateStr = localDateStr(current);
        const month = current.getMonth();
        if (row === 0 && month !== lastMonth) {
          monthLabels.push({ label: `${month + 1}월`, colIndex: col });
          lastMonth = month;
        }
        week.push({
          date: dateStr,
          minutes: dataMap.get(dateStr) ?? 0,
          isActive: current <= today,
        });
        current.setDate(current.getDate() + 1);
      }
      columns.push(week);
    }

    return { grid: columns, months: monthLabels, weeks };
  }, [data]);

  const totalDays    = data.filter((d) => d.minutes > 0).length;
  const totalMinutes = data.reduce((sum, d) => sum + d.minutes, 0);

  const maxStreak = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    let max = 0, cur = 0, prev = "";
    for (const d of sorted) {
      if (d.minutes > 0) {
        if (prev) {
          const diff = (new Date(d.date).getTime() - new Date(prev).getTime()) / 86400000;
          cur = diff === 1 ? cur + 1 : 1;
        } else cur = 1;
        max = Math.max(max, cur);
        prev = d.date;
      } else {
        cur = 0; prev = "";
      }
    }
    return max;
  }, [data]);

  // column-first 순서로 셀 펼치기 (week0-day0..6, week1-day0..6, ...)
  const allCells = grid.flatMap((col) => col);

  const dayLabelWidth = 20; // px

  return (
    <div className="space-y-3">
      {/* 요약 통계 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          총 <span className="text-foreground font-semibold">{totalDays}일</span> 학습
        </span>
        <span className="text-muted-foreground">
          총{" "}
          <span className="text-foreground font-semibold">
            {Math.floor(totalMinutes / 60)}시간 {totalMinutes % 60}분
          </span>
        </span>
        <span className="text-muted-foreground">
          최대 연속 <span className="text-foreground font-semibold">{maxStreak}일</span>
        </span>
      </div>

      {/* 잔디 그리드 */}
      <div className="flex" style={{ gap: 6 }}>
        {/* 요일 레이블 */}
        <div
          className="flex flex-col shrink-0 text-[10px] text-muted-foreground select-none"
          style={{ width: dayLabelWidth, gap: GAP, paddingTop: MONTH_ROW_H + GAP }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              style={{ height: CELL, lineHeight: `${CELL}px` }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 월 레이블 + 셀 영역 */}
        <div className="flex-1 min-w-0 flex flex-col" style={{ gap: GAP }}>
          {/* 월 레이블 행 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${weeks}, 1fr)`,
              gap: GAP,
              height: MONTH_ROW_H,
            }}
          >
            {grid.map((_, colIdx) => {
              const m = months.find((m) => m.colIndex === colIdx);
              return (
                <div
                  key={colIdx}
                  className="text-[10px] text-muted-foreground overflow-hidden whitespace-nowrap"
                >
                  {m?.label ?? ""}
                </div>
              );
            })}
          </div>

          {/* 셀 그리드: 7행 × N열, column-first flow */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: `repeat(7, ${CELL}px)`,
              gridAutoFlow: "column",
              gridAutoColumns: "1fr",
              gap: GAP,
            }}
          >
            {allCells.map((day, i) => {
              const intensity = day.isActive ? getIntensity(day.minutes) : -1;
              return (
                <div
                  key={i}
                  title={day.isActive ? `${day.date}: ${day.minutes}분` : ""}
                  className={cn(
                    "transition-colors",
                    intensity === -1 ? "bg-muted/30" : INTENSITY_CLASSES[intensity]
                  )}
                  style={{ borderRadius: 2 }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>적음</span>
        {INTENSITY_CLASSES.map((cls, i) => (
          <div
            key={i}
            className={cn(cls)}
            style={{ width: CELL, height: CELL, borderRadius: 2, flexShrink: 0 }}
          />
        ))}
        <span>많음</span>
      </div>
    </div>
  );
}
