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
  weeks?: number; // 표시할 주 수 (기본 17주 = 4개월)
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

const DAY_LABELS = ["일", "", "화", "", "목", "", "토"];

export function StudyHeatmap({ data, weeks = 17 }: StudyHeatmapProps) {
  const { grid, months } = useMemo(() => {
    const dataMap = new Map(data.map((d) => [d.date, d.minutes]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 오늘부터 거슬러 올라가서 weeks * 7일치 날짜 생성
    const totalDays = weeks * 7;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - totalDays + 1);
    // 일요일로 정렬
    startDate.setDate(startDate.getDate() - startDate.getDay());

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
          monthLabels.push({
            label: `${month + 1}월`,
            colIndex: col,
          });
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

    return { grid: columns, months: monthLabels };
  }, [data, weeks]);

  const totalDays = data.filter((d) => d.minutes > 0).length;
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

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          총 <span className="text-foreground font-semibold">{totalDays}일</span> 학습
        </span>
        <span className="text-muted-foreground">
          총 <span className="text-foreground font-semibold">{Math.floor(totalMinutes / 60)}시간 {totalMinutes % 60}분</span>
        </span>
        <span className="text-muted-foreground">
          최대 연속 <span className="text-foreground font-semibold">{maxStreak}일</span>
        </span>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1">
            <div className="h-4" /> {/* month label spacer */}
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="h-3 w-5 text-xs text-muted-foreground flex items-center">
                {label}
              </div>
            ))}
          </div>

          {/* Grid columns */}
          <div className="flex flex-col gap-0.5">
            {/* Month labels */}
            <div className="flex gap-0.5">
              {grid.map((_, colIdx) => {
                const month = months.find((m) => m.colIndex === colIdx);
                return (
                  <div key={colIdx} className="w-3 h-4 text-xs text-muted-foreground">
                    {month?.label ?? ""}
                  </div>
                );
              })}
            </div>
            {/* Rows (days of week) */}
            {Array.from({ length: 7 }).map((_, row) => (
              <div key={row} className="flex gap-0.5">
                {grid.map((col, colIdx) => {
                  const day = col[row];
                  const intensity = day.isActive ? getIntensity(day.minutes) : 0;
                  return (
                    <div
                      key={colIdx}
                      title={day.isActive ? `${day.date}: ${day.minutes}분` : ""}
                      className={cn(
                        "w-3 h-3 rounded-sm transition-colors",
                        day.isActive ? INTENSITY_CLASSES[intensity] : "bg-muted/30"
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>적음</span>
        {INTENSITY_CLASSES.map((cls, i) => (
          <div key={i} className={cn("w-3 h-3 rounded-sm", cls)} />
        ))}
        <span>많음</span>
      </div>
    </div>
  );
}
