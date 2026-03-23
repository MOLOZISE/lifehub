"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Trash2, Clock, Zap, Brain, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayString } from "@/lib/utils-app";
import { toast } from "sonner";
import { ACTIVITY_LABELS, ACTIVITY_OPTIONS } from "@/lib/study-constants";

type SessionActivityType = "reading" | "problem_solving" | "review" | "quiz" | "flashcard" | "lecture" | "pomodoro" | "writing";

const SCORE_LABELS: Record<number, string> = { 1:"매우 낮음", 2:"낮음", 3:"보통", 4:"높음", 5:"매우 높음" };

interface Subject { id: string; name: string; emoji: string | null; }
interface Exam { id: string; name: string; status: string; }
interface Session {
  id: string; date: string; subjectId: string | null; examId: string | null;
  materialName: string | null; activityType: string; durationMinutes: number;
  pagesOrQuestions: number | null; correctRate: number | null;
  focusScore: number | null; fatigueScore: number | null; satisfactionScore: number | null;
  memo: string | null; createdAt: string;
  subject?: { id: string; name: string; emoji: string | null };
}

function ScorePicker({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="flex gap-1.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-8 h-8 rounded-full text-sm font-medium transition-colors border ${value === n ? `${color} text-white border-transparent` : "border-border hover:bg-accent"}`}>
          {n}
        </button>
      ))}
    </div>
  );
}

const emptyForm = {
  date: "", subjectId: "", examId: "", materialName: "",
  activityType: "reading" as SessionActivityType,
  durationMinutes: "60",
  focusScore: 3, fatigueScore: 3, satisfactionScore: 3, memo: "",
};

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildCalendarDays(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const days: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(`${yearMonth}-${String(d).padStart(2, "0")}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, date: todayString() });
  const [currentMonth, setCurrentMonth] = useState(() => getMonthKey(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(todayString());

  async function loadAll() {
    const [sessRes, subRes, examRes] = await Promise.all([
      fetch("/api/study/sessions"),
      fetch("/api/study/subjects"),
      fetch("/api/study/exams"),
    ]);
    if (sessRes.ok) { const d = await sessRes.json(); setSessions(d.sessions ?? d); }
    if (subRes.ok) setSubjects(await subRes.json());
    if (examRes.ok) setExams((await examRes.json()).filter((e: Exam) => e.status === "upcoming"));
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleSave() {
    if (!form.subjectId || !form.date) { toast.error("날짜와 과목을 선택하세요."); return; }
    const res = await fetch("/api/study/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date, subjectId: form.subjectId,
        examId: form.examId || null, materialName: form.materialName || null,
        activityType: form.activityType,
        durationMinutes: Number(form.durationMinutes),
        focusScore: form.focusScore, fatigueScore: form.fatigueScore, satisfactionScore: form.satisfactionScore,
        memo: form.memo || null,
      }),
    });
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success("세션이 기록되었습니다.");
    setDialogOpen(false);
    loadAll();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/study/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    setSessions(s => s.filter(x => x.id !== id));
  }

  function changeMonth(delta: number) {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCurrentMonth(getMonthKey(d));
    setSelectedDate(null);
  }

  const today = todayString();

  const { monthSessions, minutesByDay, sessionsByDay, calendarDays, monthTotal, studyDays, avgFocus, displayedSessions } = useMemo(() => {
    const monthSessions = sessions.filter(s => s.date.startsWith(currentMonth));
    const minutesByDay: Record<string, number> = {};
    const sessionsByDay: Record<string, Session[]> = {};
    for (const s of monthSessions) {
      minutesByDay[s.date] = (minutesByDay[s.date] ?? 0) + s.durationMinutes;
      if (!sessionsByDay[s.date]) sessionsByDay[s.date] = [];
      sessionsByDay[s.date].push(s);
    }
    const calendarDays = buildCalendarDays(currentMonth);
    const monthTotal = monthSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const studyDays = Object.keys(minutesByDay).length;
    const avgFocus = monthSessions.length > 0
      ? (monthSessions.reduce((sum, s) => sum + (s.focusScore ?? 3), 0) / monthSessions.length).toFixed(1)
      : "-";
    const displayedSessions = selectedDate
      ? (sessionsByDay[selectedDate] ?? [])
      : [...monthSessions].sort((a, b) => b.date.localeCompare(a.date));
    return { monthSessions, minutesByDay, sessionsByDay, calendarDays, monthTotal, studyDays, avgFocus, displayedSessions };
  }, [sessions, currentMonth, selectedDate]);

  const [year, month] = currentMonth.split("-").map(Number);
  const monthLabel = `${year}년 ${month}월`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">학습 세션 기록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">집중도·피로도·만족도를 함께 기록하세요</p>
        </div>
        <Button onClick={() => { setForm({ ...emptyForm, date: selectedDate ?? todayString() }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />세션 추가
        </Button>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-blue-500" /><span className="text-xs text-muted-foreground">{monthLabel} 총 학습</span></div>
          <p className="text-2xl font-bold">{Math.floor(monthTotal / 60)}<span className="text-sm font-normal text-muted-foreground ml-1">시간</span> {monthTotal % 60}<span className="text-sm font-normal text-muted-foreground ml-0.5">분</span></p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Zap className="w-4 h-4 text-amber-500" /><span className="text-xs text-muted-foreground">이달 평균 집중도</span></div>
          <p className="text-2xl font-bold">{avgFocus}<span className="text-sm font-normal text-muted-foreground ml-1">/ 5</span></p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Brain className="w-4 h-4 text-purple-500" /><span className="text-xs text-muted-foreground">학습일 / 세션</span></div>
          <p className="text-2xl font-bold">{studyDays}<span className="text-sm font-normal text-muted-foreground ml-1">일</span> <span className="text-lg">{monthSessions.length}</span><span className="text-sm font-normal text-muted-foreground ml-0.5">건</span></p>
        </CardContent></Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-sm">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeMonth(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 mb-1">
            {["일","월","화","수","목","금","토"].map(d => (
              <div key={d} className={`text-center text-xs font-medium py-1 ${d === "일" ? "text-red-500" : d === "토" ? "text-blue-500" : "text-muted-foreground"}`}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;
              const mins = minutesByDay[dateStr] ?? 0;
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const dayNum = Number(dateStr.slice(8));
              const dow = (i % 7);
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`relative flex flex-col items-center py-1.5 rounded-lg transition-colors text-xs
                    ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-accent"}
                    ${dow === 0 && !isSelected ? "text-red-500" : dow === 6 && !isSelected ? "text-blue-500" : ""}`}
                >
                  <span className={`font-medium ${isToday && !isSelected ? "text-primary font-bold" : ""}`}>{dayNum}</span>
                  {mins > 0 && (
                    <span className={`text-[10px] mt-0.5 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {mins >= 60 ? `${Math.floor(mins/60)}h${mins%60>0?`${mins%60}m`:""}` : `${mins}m`}
                    </span>
                  )}
                  {mins > 0 && !isSelected && (
                    <div className={`absolute bottom-1 w-1 h-1 rounded-full ${mins >= 120 ? "bg-green-500" : "bg-blue-400"}`} />
                  )}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{selectedDate} 선택됨 ({sessionsByDay[selectedDate]?.length ?? 0}건)</span>
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setSelectedDate(null)}>전체 보기</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session list */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {selectedDate ? `${selectedDate} 세션` : `${monthLabel} 전체 세션`} ({displayedSessions.length}건)
        </p>
        <div className="space-y-2">
          {loading ? <p className="text-center py-8 text-muted-foreground">불러오는 중...</p>
          : displayedSessions.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-8 text-center">
              <p className="text-2xl mb-2">📝</p><p className="text-sm text-muted-foreground">기록된 세션이 없습니다</p>
            </CardContent></Card>
          ) : displayedSessions.map(session => {
            const subj = session.subject ?? subjects.find(s => s.id === session.subjectId);
            return (
              <Card key={session.id}><CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{subj?.emoji} {subj?.name ?? "알 수 없음"}</span>
                      <Badge variant="outline" className="text-xs">{ACTIVITY_LABELS[session.activityType as SessionActivityType]}</Badge>
                      {!selectedDate && <span className="text-xs text-muted-foreground">{session.date}</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{session.durationMinutes}분</span>
{session.materialName && <span>📚 {session.materialName}</span>}
                    </div>
                    {(session.focusScore || session.fatigueScore || session.satisfactionScore) && (
                      <div className="flex gap-4 text-xs">
                        <span>집중 <span className={`font-bold ${(session.focusScore??3) >= 4 ? "text-green-600" : (session.focusScore??3) <= 2 ? "text-red-500" : "text-amber-500"}`}>{session.focusScore}/5</span></span>
                        <span>피로 <span className={`font-bold ${(session.fatigueScore??3) >= 4 ? "text-red-500" : (session.fatigueScore??3) <= 2 ? "text-green-600" : "text-amber-500"}`}>{session.fatigueScore}/5</span></span>
                        <span>만족 <span className={`font-bold ${(session.satisfactionScore??3) >= 4 ? "text-green-600" : (session.satisfactionScore??3) <= 2 ? "text-red-500" : "text-amber-500"}`}>{session.satisfactionScore}/5</span></span>
                      </div>
                    )}
                    {session.memo && <p className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{session.memo}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDelete(session.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent></Card>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>학습 세션 기록</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              {/* 날짜 + 과목 */}
              <div className="grid grid-cols-[1fr_1.5fr] gap-2">
                <div>
                  <p className="text-xs mb-1 font-medium">날짜 *</p>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-8 text-xs px-2" />
                </div>
                <div>
                  <p className="text-xs mb-1 font-medium">과목 *</p>
                  <Select value={form.subjectId} onValueChange={v => v && setForm(f => ({ ...f, subjectId: v }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <span className="truncate">
                        {(() => { const s = subjects.find(x => x.id === form.subjectId); return s ? `${s.emoji ?? ""} ${s.name}`.trim() : "선택"; })()}
                      </span>
                    </SelectTrigger>
                    <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {/* 학습 유형 + 학습 시간 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs mb-1 font-medium">학습 유형</p>
                  <Select value={form.activityType} onValueChange={v => setForm(f => ({ ...f, activityType: v as SessionActivityType }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <span className="truncate">{ACTIVITY_LABELS[form.activityType] ?? form.activityType}</span>
                    </SelectTrigger>
                    <SelectContent>{ACTIVITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs mb-1 font-medium">학습 시간 (분)</p>
                  <Input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
              <div><p className="text-xs mb-1 font-medium">사용 자료</p><Input value={form.materialName} onChange={e => setForm(f => ({ ...f, materialName: e.target.value }))} placeholder="예: 시나공 필기" /></div>
              {exams.length > 0 && (
                <div><p className="text-xs mb-1 font-medium">연결 시험 (선택)</p>
                  <Select value={form.examId} onValueChange={v => setForm(f => ({ ...f, examId: v === "none" ? "" : (v ?? f.examId) }))}>
                    <SelectTrigger>
                      <span className="truncate">
                        {form.examId ? (exams.find(e => e.id === form.examId)?.name ?? "시험 선택") : "시험 선택"}
                      </span>
                    </SelectTrigger>
                    <SelectContent><SelectItem value="none">없음</SelectItem>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-semibold">학습 상태 평가 (1=낮음, 5=높음)</p>
              <div><p className="text-xs text-muted-foreground mb-1.5">집중도 — {SCORE_LABELS[form.focusScore]}</p><ScorePicker value={form.focusScore} onChange={v => setForm(f => ({ ...f, focusScore: v }))} color="bg-blue-500" /></div>
              <div><p className="text-xs text-muted-foreground mb-1.5">피로도 — {SCORE_LABELS[form.fatigueScore]}</p><ScorePicker value={form.fatigueScore} onChange={v => setForm(f => ({ ...f, fatigueScore: v }))} color="bg-red-500" /></div>
              <div><p className="text-xs text-muted-foreground mb-1.5">만족도 — {SCORE_LABELS[form.satisfactionScore]}</p><ScorePicker value={form.satisfactionScore} onChange={v => setForm(f => ({ ...f, satisfactionScore: v }))} color="bg-green-500" /></div>
            </div>
            <div><p className="text-xs mb-1 font-medium">메모</p>
              <Textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="오늘 어려웠던 점, 느낀 점..." className="h-20 text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!form.subjectId || !form.date}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
