"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Clock, Trophy, CalendarClock, ChevronDown, ChevronUp, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubjectCard } from "@/components/study/SubjectCard";
import { toast } from "sonner";
import { COLOR_MAP, todayString, localDateStr } from "@/lib/utils-app";
import type { Subject, SubjectColor } from "@/lib/types";

const ACTIVITY_LABELS: Record<string, string> = {
  reading: "📖 읽기", lecture: "🎓 강의", problem: "✏️ 문제풀기",
  review: "🔁 복습", writing: "📝 필기", other: "📌 기타",
};

interface ApiSubject extends Subject {
  _count?: { notes: number; flashcards: number; quizQuestions: number };
}
interface SessionData { subjectId: string; durationMinutes: number; date: string; }
interface ExamData { id: string; name: string; examDate: string; }

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return d >= weekStart && d <= now;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [allSessions, setAllSessions] = useState<SessionData[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, { minutes: number; count: number }>>({});
  const [upcomingExams, setUpcomingExams] = useState<ExamData[]>([]);
  const [loading, setLoading] = useState(true);

  // 과목 추가/수정 다이얼로그
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiSubject | null>(null);
  const [formData, setFormData] = useState({ name: "", color: "blue", emoji: "📚", examDate: "" });
  const [deleteTarget, setDeleteTarget] = useState<ApiSubject | undefined>();

  // 빠른 기록 추가
  const [quickSubjectId, setQuickSubjectId] = useState("");
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickForm, setQuickForm] = useState({
    date: todayString(),
    durationMinutes: 60,
    activityType: "lecture",
    memo: "",
    satisfactionScore: 3,
  });

  async function loadAll() {
    const today = todayString();
    const [subRes, sessRes, examRes] = await Promise.all([
      fetch("/api/study/subjects"),
      fetch(`/api/study/sessions?limit=1000`),
      fetch("/api/study/exams"),
    ]);
    if (subRes.ok) setSubjects(await subRes.json());
    if (sessRes.ok) {
      const data = await sessRes.json();
      const sessions: SessionData[] = (data.sessions ?? data ?? []).map((s: SessionData) => ({
        ...s,
        date: s.date?.slice(0, 10) ?? today,
      }));
      setAllSessions(sessions);
      const map: Record<string, { minutes: number; count: number }> = {};
      sessions.forEach(s => {
        if (!map[s.subjectId]) map[s.subjectId] = { minutes: 0, count: 0 };
        map[s.subjectId].minutes += s.durationMinutes;
        map[s.subjectId].count += 1;
      });
      setSessionMap(map);
    }
    if (examRes.ok) {
      const exams: ExamData[] = await examRes.json();
      const future = exams
        .filter(e => new Date(e.examDate) >= new Date())
        .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
      setUpcomingExams(future.slice(0, 3));
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // 통계 계산
  const today = todayString();
  const todayMinutes = allSessions.filter(s => s.date === today).reduce((a, s) => a + s.durationMinutes, 0);
  const weekMinutes = allSessions.filter(s => isThisWeek(s.date)).reduce((a, s) => a + s.durationMinutes, 0);
  const totalSessions = allSessions.length;

  const streak = (() => {
    const dateSet = new Set(allSessions.map(s => s.date?.slice(0, 10)));
    let count = 0;
    const now = new Date();
    while (true) {
      const d = new Date(now);
      d.setDate(d.getDate() - count);
      if (dateSet.has(localDateStr(d))) count++;
      else break;
    }
    return count;
  })();

  const upcomingExam = upcomingExams[0] ?? null;
  const upcomingDDay = upcomingExam
    ? Math.ceil((new Date(upcomingExam.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // 빠른 기록 저장
  async function handleQuickSave() {
    if (!quickSubjectId) { toast.error("과목을 선택하세요."); return; }
    if (quickForm.durationMinutes < 1) { toast.error("시간을 입력하세요."); return; }
    setQuickSaving(true);
    const res = await fetch("/api/study/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...quickForm,
        subjectId: quickSubjectId,
        focusScore: 3,
        fatigueScore: 3,
        materialName: "",
      }),
    });
    setQuickSaving(false);
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success("공부 기록이 추가되었습니다! 🎉");
    setQuickForm(f => ({ ...f, memo: "", satisfactionScore: 3 }));
    setQuickExpanded(false);
    loadAll();
  }

  // 과목 저장
  function openAdd() {
    setEditTarget(null);
    setFormData({ name: "", color: "blue", emoji: "📚", examDate: "" });
    setFormOpen(true);
  }
  function openEdit(s: ApiSubject) {
    setEditTarget(s);
    setFormData({ name: s.name, color: s.color, emoji: s.emoji ?? "📚", examDate: s.examDate ? localDateStr(new Date(s.examDate)) : "" });
    setFormOpen(true);
  }
  async function handleSave() {
    if (!formData.name.trim()) { toast.error("과목명을 입력하세요."); return; }
    const payload = { ...formData, examDate: formData.examDate || null };
    const url = editTarget ? `/api/study/subjects/${editTarget.id}` : "/api/study/subjects";
    const method = editTarget ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success(editTarget ? "과목이 수정되었습니다." : "과목이 추가되었습니다.");
    setFormOpen(false);
    loadAll();
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/study/subjects/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    toast.success("삭제되었습니다.");
    setDeleteTarget(undefined);
    loadAll();
  }

  const COLORS = ["red","orange","yellow","green","blue","indigo","purple","pink"];
  const EMOJIS = ["📚","✏️","🔬","🧮","💻","🎨","🌏","⚖️","🏥","🏗️","📊","🎵","🧪","📐","🌱","🤖"];
  const bgMap: Record<string, string> = { red:"bg-red-500", orange:"bg-orange-500", yellow:"bg-yellow-500", green:"bg-green-500", blue:"bg-blue-500", indigo:"bg-indigo-500", purple:"bg-purple-500", pink:"bg-pink-500" };

  const selectedSubject = subjects.find(s => s.id === quickSubjectId);
  const colors = selectedSubject ? (COLOR_MAP[selectedSubject.color as SubjectColor] ?? COLOR_MAP["blue"]) : null;

  if (loading) return <div className="text-center py-20 text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── 학습 현황 요약 ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">📊 오늘 학습 현황</h2>
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-100 dark:bg-orange-950 px-2 py-0.5 rounded-full">
                🔥 {streak}일 연속
              </span>
            )}
          </div>
          <Link href="/study/daily">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Timer className="w-3.5 h-3.5" />집중 타이머
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {/* 오늘 공부 + 연속 학습 */}
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-xl font-bold">
                {Math.floor(todayMinutes / 60) > 0 ? `${Math.floor(todayMinutes / 60)}h ` : ""}
                {todayMinutes % 60 > 0 ? `${todayMinutes % 60}m` : todayMinutes === 0 ? "0m" : ""}
              </p>
              <p className="text-xs text-muted-foreground">오늘 공부</p>
              {streak > 0 && (
                <p className="text-[11px] text-orange-500 mt-1">🔥 {streak}일 연속</p>
              )}
            </CardContent>
          </Card>
          {/* 이번 주 */}
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <p className="text-xl font-bold">
                {Math.floor(weekMinutes / 60) > 0 ? `${Math.floor(weekMinutes / 60)}h` : `${weekMinutes}m`}
              </p>
              <p className="text-xs text-muted-foreground">이번 주</p>
            </CardContent>
          </Card>
          {/* 총 공부 횟수 */}
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-amber-500" />
              <p className="text-xl font-bold">{totalSessions}</p>
              <p className="text-xs text-muted-foreground">총 공부 횟수</p>
            </CardContent>
          </Card>
          {/* 시험 D-Day + 목록 */}
          <Card>
            <CardContent className="p-4">
              <CalendarClock className="w-5 h-5 mx-auto mb-1 text-orange-500" />
              {upcomingExams.length === 0 ? (
                <div className="text-center">
                  <p className="text-xl font-bold text-muted-foreground">-</p>
                  <p className="text-xs text-muted-foreground">예정 시험 없음</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {upcomingExams.map((exam, i) => {
                    const dDay = Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={exam.id} className="flex items-center justify-between">
                        <span className={`text-xs truncate mr-1 ${i === 0 ? "font-medium" : "text-muted-foreground"}`}>{exam.name}</span>
                        <span className={`text-xs font-bold shrink-0 ${dDay <= 7 ? "text-red-500" : dDay <= 30 ? "text-orange-500" : "text-muted-foreground"}`}>
                          D-{Math.max(0, dDay)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 빠른 공부 기록 ── */}
      <div className="border rounded-xl overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setQuickExpanded(v => !v)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">✏️ 공부 기록 추가</span>
            {selectedSubject && (
              <Badge style={{ backgroundColor: colors?.bg.replace("bg-", "") }} className={`${colors?.bg} text-white border-0 text-[10px]`}>
                {selectedSubject.emoji} {selectedSubject.name}
              </Badge>
            )}
          </div>
          {quickExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>

        <div className={`transition-all duration-200 ${quickExpanded ? "block" : "hidden"}`}>
          <div className="p-4 space-y-3">
            {/* 과목 선택 */}
            <div>
              <p className="text-xs font-medium mb-1">과목 선택 *</p>
              <Select value={quickSubjectId} onValueChange={v => v && setQuickSubjectId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="과목을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs font-medium mb-1">날짜</p>
                <Input type="date" value={quickForm.date} onChange={e => setQuickForm(f => ({ ...f, date: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">공부 시간 (분)</p>
                <Input type="number" value={quickForm.durationMinutes} min={1}
                  onChange={e => setQuickForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} className="h-9 text-sm" />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">활동 유형</p>
                <Select value={quickForm.activityType} onValueChange={v => v && setQuickForm(f => ({ ...f, activityType: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-1">메모 (선택)</p>
              <Textarea
                value={quickForm.memo}
                placeholder="오늘 공부한 내용, 느낀 점..."
                onChange={e => setQuickForm(f => ({ ...f, memo: e.target.value }))}
                className="h-16 resize-none text-sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium mb-1">만족도</p>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setQuickForm(f => ({ ...f, satisfactionScore: n }))}
                      className={`text-xl transition-opacity hover:scale-110 ${n <= quickForm.satisfactionScore ? "opacity-100" : "opacity-20"}`}>
                      ⭐
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleQuickSave} disabled={quickSaving || !quickSubjectId}>
                {quickSaving ? "저장 중..." : "기록 저장"}
              </Button>
            </div>
          </div>
        </div>

        {/* 접힌 상태일 때 클릭 유도 */}
        {!quickExpanded && (
          <button
            className="w-full px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/30 transition-colors border-t"
            onClick={() => setQuickExpanded(true)}
          >
            <span className="text-xs">과목 선택 후 공부 시간을 바로 기록하세요 →</span>
          </button>
        )}
      </div>

      {/* ── 과목 목록 ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">📚 내 과목 <span className="text-muted-foreground font-normal">({subjects.length})</span></h2>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1.5" />과목 추가</Button>
        </div>

        {subjects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border rounded-xl">
            <p className="text-4xl mb-3">📚</p>
            <p className="font-medium">과목이 없습니다</p>
            <p className="text-sm mt-1 mb-4">공부할 과목을 추가해보세요!</p>
            <Button onClick={openAdd}><Plus className="w-4 h-4 mr-1.5" />첫 과목 추가</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map(subject => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                noteCount={subject._count?.notes ?? 0}
                questionCount={subject._count?.quizQuestions ?? 0}
                flashcardCount={subject._count?.flashcards ?? 0}
                knownCount={0}
                totalMinutes={sessionMap[subject.id]?.minutes ?? 0}
                sessionCount={sessionMap[subject.id]?.count ?? 0}
                onEdit={() => openEdit(subject)}
                onDelete={() => setDeleteTarget(subject)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 과목 추가/수정 다이얼로그 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "과목 수정" : "과목 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium mb-2">아이콘</p>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setFormData(f => ({ ...f, emoji: e }))}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${formData.emoji === e ? "border-primary bg-accent" : "border-transparent hover:border-muted"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">색상</p>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setFormData(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${bgMap[c]} ${formData.color === c ? "border-foreground scale-110" : "border-transparent"}`} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">과목명 *</p>
              <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="예: 정보처리기사" />
            </div>
            <p className="text-xs text-muted-foreground">💡 시험 날짜·결과는 과목 상세 → 시험 탭에서 관리하세요</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(undefined)}>
        <DialogContent>
          <DialogHeader><DialogTitle>과목 삭제</DialogTitle></DialogHeader>
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
