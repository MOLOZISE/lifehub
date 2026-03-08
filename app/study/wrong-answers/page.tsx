"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, RotateCcw, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSubjects, getWrongAnswerNotes, saveWrongAnswerNote, deleteWrongAnswerNote } from "@/lib/storage";
import { generateId, todayString } from "@/lib/utils-app";
import type { WrongAnswerNote, WrongReason, Subject } from "@/lib/types";

const REASON_LABELS: Record<WrongReason, string> = {
  concept_gap: "🧠 개념 미숙",
  memory_gap: "💭 암기 부족",
  careless: "⚡ 실수",
  time_pressure: "⏰ 시간 부족",
  confusion: "🌀 헷갈림",
};

const REASON_COLORS: Record<WrongReason, string> = {
  concept_gap: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  memory_gap: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  careless: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  time_pressure: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  confusion: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

/** Calculate next review date using simple spaced repetition */
function nextReviewDate(reviewCount: number): string {
  const intervals = [1, 3, 7, 14, 30, 60]; // days
  const days = intervals[Math.min(reviewCount, intervals.length - 1)];
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const emptyForm = {
  subjectId: "",
  questionText: "",
  myAnswer: "",
  correctAnswer: "",
  explanation: "",
  reason: "concept_gap" as WrongReason,
  tags: "",
};

export default function WrongAnswersPage() {
  const [notes, setNotes] = useState<WrongAnswerNote[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterSubject, setFilterSubject] = useState("all");
  const [showResolved, setShowResolved] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const today = todayString();

  useEffect(() => {
    setSubjects(getSubjects());
    loadNotes();
  }, []);

  function loadNotes() {
    const all = getWrongAnswerNotes().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setNotes(all);
  }

  function openAdd() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.subjectId || !form.questionText || !form.correctAnswer) return;
    const note: WrongAnswerNote = {
      id: generateId(),
      subjectId: form.subjectId,
      questionText: form.questionText,
      myAnswer: form.myAnswer || undefined,
      correctAnswer: form.correctAnswer,
      explanation: form.explanation || undefined,
      reason: form.reason,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      reviewCount: 0,
      nextReviewAt: nextReviewDate(0),
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    saveWrongAnswerNote(note);
    loadNotes();
    setDialogOpen(false);
  }

  function handleReview(note: WrongAnswerNote, remembered: boolean) {
    const updatedNote: WrongAnswerNote = {
      ...note,
      reviewCount: note.reviewCount + 1,
      lastReviewedAt: new Date().toISOString(),
      nextReviewAt: remembered ? nextReviewDate(note.reviewCount + 1) : nextReviewDate(0),
      resolved: remembered && note.reviewCount >= 4,
    };
    saveWrongAnswerNote(updatedNote);
    setReviewingId(null);
    loadNotes();
  }

  function handleDelete(id: string) {
    deleteWrongAnswerNote(id);
    loadNotes();
  }

  const filtered = notes.filter(n => {
    if (!showResolved && n.resolved) return false;
    if (filterSubject !== "all" && n.subjectId !== filterSubject) return false;
    return true;
  });

  const dueCount = notes.filter(n => !n.resolved && n.nextReviewAt <= today).length;
  const totalActive = notes.filter(n => !n.resolved).length;

  const reasonStats = notes.filter(n => !n.resolved).reduce((acc, n) => {
    acc[n.reason] = (acc[n.reason] ?? 0) + 1;
    return acc;
  }, {} as Record<WrongReason, number>);

  const topReason = Object.entries(reasonStats).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">오답 노트</h1>
          <p className="text-sm text-muted-foreground mt-0.5">틀린 이유를 분석하고 간격 반복으로 복습</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-1.5" />오답 추가</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">오늘 복습 예정</p>
            <p className={`text-2xl font-bold ${dueCount > 0 ? "text-red-500" : ""}`}>{dueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">미해결 오답</p>
            <p className="text-2xl font-bold">{totalActive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">해결 완료</p>
            <p className="text-2xl font-bold text-green-500">{notes.filter(n => n.resolved).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">주요 원인</p>
            <p className="text-sm font-semibold">{topReason ? REASON_LABELS[topReason[0] as WrongReason] : "-"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reason distribution */}
      {totalActive > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold mb-2 text-muted-foreground">오답 원인 분포</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(REASON_LABELS) as WrongReason[]).map(r => {
                const count = reasonStats[r] ?? 0;
                if (count === 0) return null;
                return (
                  <div key={r} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${REASON_COLORS[r]}`}>
                    <span>{REASON_LABELS[r]}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterSubject} onValueChange={v => v && setFilterSubject(v)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="과목 필터" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 과목</SelectItem>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={showResolved ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowResolved(!showResolved)}
        >
          <CheckCircle className="w-3 h-3 mr-1" />해결됨 포함
        </Button>
      </div>

      {/* Notes list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-muted-foreground">
                {notes.length === 0 ? "오답 노트가 없습니다" : "조건에 맞는 오답이 없습니다"}
              </p>
              {notes.length === 0 && (
                <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
                  <Plus className="w-3.5 h-3.5 mr-1" />오답 추가
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map(note => {
            const subject = subjects.find(s => s.id === note.subjectId);
            const isDue = !note.resolved && note.nextReviewAt <= today;
            const isReviewing = reviewingId === note.id;

            return (
              <Card key={note.id} className={`${note.resolved ? "opacity-60" : ""} ${isDue && !note.resolved ? "border-amber-400 dark:border-amber-700" : ""}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {subject?.emoji} {subject?.name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REASON_COLORS[note.reason]}`}>
                          {REASON_LABELS[note.reason]}
                        </span>
                        {note.resolved && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-400">해결됨</Badge>
                        )}
                        {isDue && (
                          <Badge className="text-xs bg-amber-500">복습 예정</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium">{note.questionText}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!note.resolved && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setReviewingId(isReviewing ? null : note.id)}
                          title="복습 기록"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(note.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    {note.myAnswer && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground text-xs w-14 shrink-0">내 답:</span>
                        <span className="text-red-500 text-xs">{note.myAnswer}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-muted-foreground text-xs w-14 shrink-0">정답:</span>
                      <span className="text-green-600 dark:text-green-400 text-xs font-medium">{note.correctAnswer}</span>
                    </div>
                    {note.explanation && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground text-xs w-14 shrink-0">해설:</span>
                        <span className="text-xs">{note.explanation}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>복습 {note.reviewCount}회</span>
                    {!note.resolved && <span>다음 복습: {note.nextReviewAt}</span>}
                    {note.tags.length > 0 && (
                      <div className="flex gap-1">
                        {note.tags.map(t => (
                          <span key={t} className="bg-muted px-1.5 py-0.5 rounded text-xs">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {isReviewing && (
                    <div className="flex gap-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground mr-1 flex items-center">이번에 맞췄나요?</span>
                      <Button size="sm" className="h-7 bg-green-500 hover:bg-green-600 text-xs" onClick={() => handleReview(note, true)}>
                        ✅ 맞았음
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-600" onClick={() => handleReview(note, false)}>
                        ❌ 또 틀림
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>오답 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <p className="text-xs mb-1 font-medium">과목 *</p>
              <Select value={form.subjectId} onValueChange={v => v && setForm(f => ({ ...f, subjectId: v }))}>
                <SelectTrigger><SelectValue placeholder="과목 선택" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">문제 내용 *</p>
              <Textarea value={form.questionText} onChange={e => setForm(f => ({ ...f, questionText: e.target.value }))} placeholder="틀린 문제를 입력하세요" className="h-20 text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1 font-medium">내가 쓴 답</p>
                <Input value={form.myAnswer} onChange={e => setForm(f => ({ ...f, myAnswer: e.target.value }))} placeholder="내 오답" />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">정답 *</p>
                <Input value={form.correctAnswer} onChange={e => setForm(f => ({ ...f, correctAnswer: e.target.value }))} placeholder="정답" />
              </div>
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">해설/이유</p>
              <Textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} placeholder="왜 틀렸는지, 핵심 개념..." className="h-16 text-sm resize-none" />
            </div>
            <div>
              <p className="text-xs mb-2 font-medium">틀린 원인 *</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(REASON_LABELS) as [WrongReason, string][]).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, reason: k }))}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.reason === k
                        ? `${REASON_COLORS[k]} border-transparent font-medium`
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">태그 (쉼표 구분)</p>
              <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="예: DB, 정규화, SQL" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!form.subjectId || !form.questionText || !form.correctAnswer}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
