"use client";

import Link from "next/link";
import { MoreVertical, Pencil, Trash2, Clock, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { COLOR_MAP, formatDate } from "@/lib/utils-app";
import type { Subject } from "@/lib/types";

interface Props {
  subject: Subject;
  noteCount: number;
  questionCount: number;
  flashcardCount: number;
  knownCount: number;
  totalMinutes?: number;   // 총 공부 시간 (분)
  sessionCount?: number;   // 공부 횟수
  onEdit: () => void;
  onDelete: () => void;
}

export function SubjectCard({ subject, totalMinutes = 0, sessionCount = 0, onEdit, onDelete }: Props) {
  const colors = COLOR_MAP[subject.color];

  const dDay = subject.examDate
    ? Math.ceil((new Date(subject.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const hoursStr = totalMinutes >= 60
    ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60 > 0 ? `${totalMinutes % 60}m` : ""}`
    : totalMinutes > 0 ? `${totalMinutes}m` : "0h";

  return (
    <Card className={cn("relative overflow-hidden border-l-4 hover:shadow-md transition-shadow", colors.border)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <Link href={`/study/subjects/${subject.id}`} className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-2xl">{subject.emoji}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{subject.name}</h3>
              {subject.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{subject.description}</p>
              )}
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 shrink-0 rounded-md hover:bg-accent focus-visible:outline-none">
              <MoreVertical className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />수정
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 공부 통계 */}
        <div className="flex gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{hoursStr}</span>
          <span className="text-muted-foreground">{sessionCount}회 공부</span>
        </div>

        {/* 시험일 / D-Day — 지난 시험일은 표시 안 함 */}
        {subject.examDate && dDay !== null && dDay >= 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />{formatDate(subject.examDate)}
            </Badge>
            <Badge variant={dDay <= 7 ? "destructive" : dDay <= 30 ? "secondary" : "outline"} className="text-xs">
              {dDay > 0 ? `D-${dDay}` : "D-Day"}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
