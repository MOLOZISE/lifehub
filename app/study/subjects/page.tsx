"use client";

import { useEffect, useState } from "react";
import { Plus, Search, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { SubjectCard } from "@/components/study/SubjectCard";
import { SubjectFormDialog } from "@/components/study/SubjectFormDialog";
import { getSubjects, saveSubjects, getFlashcards, getNotes, getQuestions } from "@/lib/storage";
import type { Subject } from "@/lib/types";

type SortKey = "lastStudied" | "name" | "createdAt";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("lastStudied");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Subject | undefined>();

  useEffect(() => { setSubjects(getSubjects()); }, []);

  function handleSave(subject: Subject) {
    const next = subjects.some((s) => s.id === subject.id)
      ? subjects.map((s) => (s.id === subject.id ? subject : s))
      : [...subjects, subject];
    setSubjects(next);
    saveSubjects(next);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const next = subjects.filter((s) => s.id !== deleteTarget.id);
    setSubjects(next);
    saveSubjects(next);
    setDeleteTarget(undefined);
  }

  const filtered = subjects
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ko");
      if (sort === "createdAt") return b.createdAt.localeCompare(a.createdAt);
      // lastStudied
      const ta = a.lastStudiedAt ?? a.createdAt;
      const tb = b.lastStudiedAt ?? b.createdAt;
      return tb.localeCompare(ta);
    });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="과목 검색..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-40">
            <SortAsc className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastStudied">최근 학습순</SelectItem>
            <SelectItem value="name">이름순</SelectItem>
            <SelectItem value="createdAt">생성일순</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditTarget(undefined); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />과목 추가
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">📚</p>
          <p className="font-medium">과목이 없습니다</p>
          <p className="text-sm mt-1">새 과목을 추가해보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((subject) => {
            const notes = getNotes(subject.id);
            const questions = getQuestions(subject.id);
            const flashcards = getFlashcards(subject.id);
            const known = flashcards.filter((f) => f.known).length;
            return (
              <SubjectCard
                key={subject.id}
                subject={subject}
                noteCount={notes.length}
                questionCount={questions.length}
                flashcardCount={flashcards.length}
                knownCount={known}
                onEdit={() => { setEditTarget(subject); setFormOpen(true); }}
                onDelete={() => setDeleteTarget(subject)}
              />
            );
          })}
        </div>
      )}

      {/* Form dialog */}
      <SubjectFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        initial={editTarget}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>과목 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteTarget?.emoji} {deleteTarget?.name}</span>을(를) 삭제하면
            노트, 문제, 플래시카드 데이터가 모두 사라집니다. 정말 삭제할까요?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(undefined)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
