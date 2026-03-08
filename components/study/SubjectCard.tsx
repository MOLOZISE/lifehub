"use client";

import Link from "next/link";
import { MoreVertical, Pencil, Trash2, BookOpen, HelpCircle, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { COLOR_MAP, formatDate } from "@/lib/utils-app";
import type { Subject } from "@/lib/types";

// Need to add dropdown to shadcn
interface Props {
  subject: Subject;
  noteCount: number;
  questionCount: number;
  flashcardCount: number;
  knownCount: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function SubjectCard({ subject, noteCount, questionCount, flashcardCount, knownCount, onEdit, onDelete }: Props) {
  const colors = COLOR_MAP[subject.color];
  const flashProgress = flashcardCount > 0 ? Math.round((knownCount / flashcardCount) * 100) : 0;

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

        {/* Stats */}
        <div className="flex gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{noteCount}개 노트</span>
          <span className="flex items-center gap-1"><HelpCircle className="w-3 h-3" />{questionCount}문제</span>
          <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{flashcardCount}카드</span>
        </div>

        {/* Flashcard progress */}
        {flashcardCount > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>플래시카드 암기</span>
              <span>{knownCount}/{flashcardCount}</span>
            </div>
            <Progress value={flashProgress} className="h-1.5" />
          </div>
        )}

        {/* Exam date */}
        {subject.examDate && (
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs">
              시험: {formatDate(subject.examDate)}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
