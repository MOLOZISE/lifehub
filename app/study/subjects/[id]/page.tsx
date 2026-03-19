"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock, Plus, Link2, BookOpen, Trophy, Play, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { COLOR_MAP, formatDate, todayString } from "@/lib/utils-app";
import { toast } from "sonner";

interface SubjectDetail {
  id: string; name: string; emoji: string; color: string;
  description: string | null; examDate: string | null;
  _count: { notes: number; flashcards: number; quizQuestions: number };
}
interface StudySession {
  id: string; date: string; durationMinutes: number;
  activityType: string; materialName: string | null;
  memo: string | null; satisfactionScore: number;
}
interface StudySource {
  id: string; title: string; content: string; type: string; createdAt: string;
}
interface Exam {
  id: string; name: string; examDate: string; status: string; subjectId: string | null;
  actualScore: number | null; targetScore: number | null; passScore: number | null; memo: string | null;
}

const ACTIVITY_LABELS: Record<string, string> = {
  reading: "📖 읽기", lecture: "🎓 강의", problem: "✏️ 문제풀기",
  review: "🔁 복습", writing: "📝 필기", other: "📌 기타",
};

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [sources, setSources] = useState<StudySource[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  // 세션 추가 다이얼로그
  const [sessionDialog, setSessionDialog] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    date: todayString(),
    durationMinutes: 60, activityType: "lecture",
    materialName: "", memo: "", satisfactionScore: 3,
  });

  // 자료 추가 다이얼로그
  const [sourceDialog, setSourceDialog] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [sourceType, setSourceType] = useState("link");

  // 시험 결과 입력 다이얼로그
  const [examDialog, setExamDialog] = useState(false);
  const [examForm, setExamForm] = useState({ name: "", examDate: "", actualScore: "", targetScore: "", memo: "" });

  useEffect(() => { load(); }, [id]);

  async function load() {
    const [subRes, sessRes, srcRes, examRes] = await Promise.all([
      fetch(`/api/study/subjects/${id}`),
      fetch(`/api/study/sessions?subjectId=${id}&limit=100`),
      fetch(`/api/study/sources?subjectId=${id}`),
      fetch(`/api/study/exams`),
    ]);
    if (!subRes.ok) { router.push("/study/subjects"); return; }
    setSubject(await subRes.json());
    if (sessRes.ok) {
      const data = await sessRes.json();
      const arr: StudySession[] = data.sessions ?? data ?? [];
      setSessions(arr.filter((s: StudySession & { subjectId?: string }) => !s.subjectId || s.subjectId === id));
    }
    if (srcRes.ok) setSources(await srcRes.json());
    if (examRes.ok) {
      const all: Exam[] = await examRes.json();
      setExams(all.filter(e => e.subjectId === id));
    }
  }

  async function addSession() {
    const res = await fetch("/api/study/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sessionForm, subjectId: id, focusScore: 3, fatigueScore: 3 }),
    });
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success("공부 기록이 추가되었습니다.");
    setSessionDialog(false);
    load();
  }

  async function addSource() {
    if (!sourceTitle.trim()) return;
    const res = await fetch("/api/study/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId: id, title: sourceTitle, content: sourceContent, type: sourceType }),
    });
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success("자료가 추가되었습니다.");
    setSourceDialog(false);
    setSourceTitle(""); setSourceContent(""); setSourceType("link");
    load();
  }

  async function addExam() {
    if (!examForm.name || !examForm.examDate) return;
    const res = await fetch("/api/study/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: examForm.name, examDate: examForm.examDate, category: subject?.name ?? "",
        subjectId: id,
        actualScore: examForm.actualScore ? Number(examForm.actualScore) : null,
        targetScore: examForm.targetScore ? Number(examForm.targetScore) : null,
        memo: examForm.memo, status: examForm.actualScore ? "completed" : "preparing",
      }),
    });
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success("시험 기록이 추가되었습니다.");
    setExamDialog(false);
    load();
  }

  if (!subject) return null;

  const colors = COLOR_MAP[subject.color as import("@/lib/types").SubjectColor] ?? COLOR_MAP["blue"];

  // 통계 계산
  const totalMinutes = sessions.reduce((s, sess) => s + sess.durationMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const thisMonthMinutes = sessions
    .filter(s => s.date.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((s, sess) => s + sess.durationMinutes, 0);

  const dDay = subject.examDate
    ? Math.ceil((new Date(subject.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <LinkButton variant="ghost" size="icon" href="/study/subjects"><ArrowLeft className="w-4 h-4" /></LinkButton>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-3xl">{subject.emoji}</span>
            <h1 className="text-2xl font-bold">{subject.name}</h1>
            <Badge className={`${colors.bg} text-white border-0`}>{subject.color}</Badge>
          </div>
          {subject.description && <p className="text-muted-foreground mt-1">{subject.description}</p>}
          {subject.examDate && (
            <p className="text-sm mt-1 flex items-center gap-1.5 font-medium">
              <CalendarClock className="w-4 h-4 text-orange-500" />
              시험일: {formatDate(subject.examDate)}
              {dDay !== null && (
                <Badge variant={dDay <= 7 ? "destructive" : dDay <= 30 ? "secondary" : "outline"} className="ml-1">
                  {dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-Day" : "종료"}
                </Badge>
              )}
            </p>
          )}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{totalHours}h {totalMins}m</p>
            <p className="text-xs text-muted-foreground">총 공부 시간</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Play className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{Math.floor(thisMonthMinutes / 60)}h</p>
            <p className="text-xs text-muted-foreground">이번 달</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-muted-foreground">공부 횟수</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sessions">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sessions">📋 공부 기록</TabsTrigger>
          <TabsTrigger value="exams">📅 시험 일정</TabsTrigger>
          <TabsTrigger value="sources">📎 자료 링크</TabsTrigger>
        </TabsList>

        {/* 공부 기록 탭 */}
        <TabsContent value="sessions" className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">총 {sessions.length}회</p>
            <Button size="sm" onClick={() => setSessionDialog(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> 기록 추가
            </Button>
          </div>
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>아직 공부 기록이 없습니다.</p>
              <p className="text-xs mt-1">오늘 공부한 내용을 기록해보세요!</p>
            </div>
          ) : (
            [...sessions].reverse().map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="shrink-0 text-center min-w-[52px]">
                  <p className="text-xs text-muted-foreground">{s.date.slice(5)}</p>
                  <p className="font-bold text-sm">{Math.floor(s.durationMinutes / 60) > 0 ? `${Math.floor(s.durationMinutes / 60)}h` : ""}{s.durationMinutes % 60 > 0 ? `${s.durationMinutes % 60}m` : ""}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{ACTIVITY_LABELS[s.activityType] ?? s.activityType}</span>
                    {s.materialName && <span className="text-xs text-muted-foreground truncate">{s.materialName}</span>}
                  </div>
                  {s.memo && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.memo}</p>}
                </div>
                <div className="shrink-0 text-amber-500 text-sm">{"⭐".repeat(s.satisfactionScore)}</div>
              </div>
            ))
          )}
        </TabsContent>

        {/* 시험 결과 탭 */}
        <TabsContent value="exams" className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">시험 일정 및 결과</p>
            <Button size="sm" onClick={() => { setExamForm({ name: subject.name, examDate: subject.examDate?.slice(0,10) ?? "", actualScore: "", targetScore: "", memo: "" }); setExamDialog(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> 시험 추가
            </Button>
          </div>
          {exams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>시험 기록이 없습니다.</p>
            </div>
          ) : (
            exams.map(e => (
              <div key={e.id} className="p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.name}</span>
                  <Badge variant={e.status === "completed" ? "default" : "secondary"} className="text-xs">
                    {e.status === "completed" ? "완료" : e.status === "passed" ? "합격" : "준비중"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{e.examDate}</p>
                {e.actualScore != null && (
                  <div className="flex gap-3 mt-2 text-sm">
                    <span>실제: <strong>{e.actualScore}점</strong></span>
                    {e.targetScore && <span className="text-muted-foreground">목표: {e.targetScore}점</span>}
                    {e.passScore && <span className={e.actualScore >= e.passScore ? "text-green-500" : "text-red-500"}>
                      합격선: {e.passScore}점 {e.actualScore >= e.passScore ? <CheckCircle className="inline w-3.5 h-3.5" /> : "✗"}
                    </span>}
                  </div>
                )}
                {e.memo && <p className="text-xs text-muted-foreground mt-1">{e.memo}</p>}
              </div>
            ))
          )}
        </TabsContent>

        {/* 자료 링크 탭 */}
        <TabsContent value="sources" className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">강의, 링크, 메모 자료</p>
            <Button size="sm" onClick={() => setSourceDialog(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> 자료 추가
            </Button>
          </div>
          {sources.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>등록된 자료가 없습니다.</p>
              <p className="text-xs mt-1">강의 링크나 참고 자료를 추가해보세요.</p>
            </div>
          ) : (
            sources.map(s => (
              <div key={s.id} className="p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.type}</span>
                  <span className="font-medium text-sm">{s.title}</span>
                </div>
                {s.content && (
                  s.content.startsWith("http") ? (
                    <a href={s.content} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline mt-1 block truncate">
                      <Link2 className="inline w-3 h-3 mr-1" />{s.content}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.content}</p>
                  )
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* 공부 기록 추가 다이얼로그 */}
      <Dialog open={sessionDialog} onOpenChange={setSessionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>공부 기록 추가</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1 font-medium">날짜</p>
                <Input type="date" value={sessionForm.date} onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">공부 시간 (분)</p>
                <Input type="number" value={sessionForm.durationMinutes} min={1}
                  onChange={e => setSessionForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">활동 유형</p>
              <Select value={sessionForm.activityType} onValueChange={v => setSessionForm(f => ({ ...f, activityType: v as string }))}>
                <SelectTrigger><span>{ACTIVITY_LABELS[sessionForm.activityType] ?? sessionForm.activityType}</span></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">자료명 (선택)</p>
              <Input value={sessionForm.materialName} placeholder="예: 1강 - 운영체제 기초"
                onChange={e => setSessionForm(f => ({ ...f, materialName: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">메모 (선택)</p>
              <Textarea value={sessionForm.memo} placeholder="오늘 공부한 내용..."
                onChange={e => setSessionForm(f => ({ ...f, memo: e.target.value }))} className="h-16 resize-none text-sm" />
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">만족도</p>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setSessionForm(f => ({ ...f, satisfactionScore: n }))}
                    className={`text-xl transition-opacity ${n <= sessionForm.satisfactionScore ? "opacity-100" : "opacity-20"}`}>⭐</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialog(false)}>취소</Button>
            <Button onClick={addSession}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 자료 추가 다이얼로그 */}
      <Dialog open={sourceDialog} onOpenChange={setSourceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>자료 추가</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs mb-1 font-medium">유형</p>
              <Select value={sourceType} onValueChange={v => v && setSourceType(v)}>
                <SelectTrigger><span>{{ link: "🔗 링크", youtube: "▶️ 유튜브", book: "📗 교재", note: "📝 메모" }[sourceType] ?? sourceType}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">🔗 링크</SelectItem>
                  <SelectItem value="youtube">▶️ 유튜브</SelectItem>
                  <SelectItem value="book">📗 교재</SelectItem>
                  <SelectItem value="note">📝 메모</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">제목 *</p>
              <Input value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} placeholder="예: 정처기 합격 강의 (유데미)" />
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">URL 또는 내용</p>
              <Input value={sourceContent} onChange={e => setSourceContent(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourceDialog(false)}>취소</Button>
            <Button onClick={addSource} disabled={!sourceTitle.trim()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 시험 추가 다이얼로그 */}
      <Dialog open={examDialog} onOpenChange={setExamDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>시험 기록 추가</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs mb-1 font-medium">시험명 *</p>
              <Input value={examForm.name} onChange={e => setExamForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 정보처리기사 필기" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1 font-medium">시험일 *</p>
                <Input type="date" value={examForm.examDate} onChange={e => setExamForm(f => ({ ...f, examDate: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">실제 점수</p>
                <Input type="number" value={examForm.actualScore} placeholder="미응시 시 빈칸"
                  onChange={e => setExamForm(f => ({ ...f, actualScore: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1 font-medium">목표 점수</p>
                <Input type="number" value={examForm.targetScore} onChange={e => setExamForm(f => ({ ...f, targetScore: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">메모</p>
                <Input value={examForm.memo} onChange={e => setExamForm(f => ({ ...f, memo: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamDialog(false)}>취소</Button>
            <Button onClick={addExam} disabled={!examForm.name || !examForm.examDate}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
