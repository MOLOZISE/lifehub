"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Trophy, Calendar, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayString, localDateStr } from "@/lib/utils-app";
import { toast } from "sonner";

type ExamStatus = "upcoming" | "passed" | "failed" | "cancelled";

const STATUS_LABELS: Record<ExamStatus, string> = {
  upcoming: "준비중", passed: "합격", failed: "불합격", cancelled: "취소",
};

const STATUS_COLORS: Record<ExamStatus, string> = {
  upcoming: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  passed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400",
};

const CATEGORY_OPTIONS = ["자격증", "어학", "TOPCIT", "공무원", "대학시험", "기타"];

interface Exam {
  id: string; name: string; category: string | null; examDate: string;
  targetScore: number | null; passScore: number | null; actualScore: number | null;
  status: ExamStatus; memo: string | null; createdAt: string;
}

const emptyForm = {
  name: "", category: "자격증", examDate: "",
  targetScore: "", passScore: "", memo: "",
  status: "upcoming" as ExamStatus, actualScore: "",
};

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [form, setForm] = useState(emptyForm);

  const today = todayString();

  async function loadExams() {
    const res = await fetch("/api/study/exams");
    if (res.ok) setExams(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadExams(); }, []);

  function daysUntil(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - new Date(today).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }

  function openEdit(exam: Exam) {
    setEditing(exam);
    setForm({
      name: exam.name, category: exam.category ?? "자격증",
      examDate: localDateStr(new Date(exam.examDate)),
      targetScore: exam.targetScore?.toString() ?? "",
      passScore: exam.passScore?.toString() ?? "",
      memo: exam.memo ?? "", status: exam.status,
      actualScore: exam.actualScore?.toString() ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.examDate) { toast.error("시험명과 날짜를 입력하세요."); return; }
    const payload = {
      name: form.name, category: form.category, examDate: form.examDate,
      targetScore: form.targetScore || null, passScore: form.passScore || null,
      memo: form.memo || null, status: form.status,
      actualScore: form.actualScore || null,
    };
    const url = editing ? `/api/study/exams/${editing.id}` : "/api/study/exams";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success(editing ? "수정되었습니다." : "시험이 추가되었습니다.");
    setDialogOpen(false);
    loadExams();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 시험을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/study/exams/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    setExams(e => e.filter(x => x.id !== id));
  }

  const active = exams.filter(e => e.status === "upcoming");
  const past = exams.filter(e => e.status !== "upcoming");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">시험 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">D-day 추적 및 목표 점수 관리</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-1.5" />시험 추가</Button>
      </div>

      {loading ? <p className="text-center py-12 text-muted-foreground">불러오는 중...</p> : (
        <>
          {active.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">준비중인 시험</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {active.map(exam => {
                  const days = daysUntil(exam.examDate);
                  const urgency = days <= 7 ? "border-red-400 dark:border-red-700" : days <= 30 ? "border-amber-400 dark:border-amber-700" : "";
                  return (
                    <Card key={exam.id} className={`border-2 ${urgency}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{exam.name}</p>
                            <p className="text-xs text-muted-foreground">{exam.category}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exam)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(exam.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm">{new Date(exam.examDate).toLocaleDateString("ko-KR")}</span>
                          </div>
                          <div className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                            days <= 0 ? "bg-gray-100 text-gray-600" :
                            days <= 7 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                            days <= 30 ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                            "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}>
                            {days <= 0 ? "D-day" : `D-${days}`}
                          </div>
                        </div>
                        <div className="flex gap-3 text-sm">
                          {exam.targetScore != null && <div className="flex items-center gap-1"><Target className="w-3.5 h-3.5 text-indigo-500" /><span>목표 {exam.targetScore}점</span></div>}
                          {exam.passScore != null && <div className="text-muted-foreground">합격선 {exam.passScore}점</div>}
                        </div>
                        {exam.memo && <p className="text-xs text-muted-foreground">{exam.memo}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="border-dashed"><CardContent className="p-8 text-center">
              <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">준비중인 시험이 없습니다</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}><Plus className="w-3.5 h-3.5 mr-1" />시험 추가</Button>
            </CardContent></Card>
          )}

          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">완료된 시험</h2>
              <div className="space-y-2">
                {past.map(exam => (
                  <div key={exam.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{exam.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[exam.status]}`}>{STATUS_LABELS[exam.status]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(exam.examDate).toLocaleDateString("ko-KR")}
                        {exam.actualScore != null && ` · 실제 점수: ${exam.actualScore}점`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exam)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(exam.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "시험 수정" : "시험 추가"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><p className="text-xs mb-1 font-medium">시험명 *</p><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 정보처리기사 필기" /></div>
              <div><p className="text-xs mb-1 font-medium">분류</p>
                <Select value={form.category} onValueChange={v => v && setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><p className="text-xs mb-1 font-medium">상태</p>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ExamStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.entries(STATUS_LABELS) as [ExamStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><p className="text-xs mb-1 font-medium">시험일 *</p><Input type="date" value={form.examDate} onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))} /></div>
              <div><p className="text-xs mb-1 font-medium">목표 점수</p><Input type="number" value={form.targetScore} onChange={e => setForm(f => ({ ...f, targetScore: e.target.value }))} placeholder="예: 80" /></div>
              <div><p className="text-xs mb-1 font-medium">합격 기준 점수</p><Input type="number" value={form.passScore} onChange={e => setForm(f => ({ ...f, passScore: e.target.value }))} placeholder="예: 60" /></div>
              {(form.status === "passed" || form.status === "failed") && (
                <div><p className="text-xs mb-1 font-medium">실제 점수</p><Input type="number" value={form.actualScore} onChange={e => setForm(f => ({ ...f, actualScore: e.target.value }))} placeholder="예: 75" /></div>
              )}
              <div className="col-span-2"><p className="text-xs mb-1 font-medium">메모</p><Input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="예: 1차 시험, 실기 제외" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.examDate}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
