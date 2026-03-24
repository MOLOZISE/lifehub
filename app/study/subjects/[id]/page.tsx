"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock, Plus, Link2, BookOpen, Trophy, Play, CheckCircle, Pencil, Trash2, Search, Loader2, Share2, Users, ExternalLink } from "lucide-react";
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
import { ACTIVITY_LABELS, ACTIVITY_OPTIONS } from "@/lib/study-constants";

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
  officialExamId: string | null; category: string | null;
  organization: string | null; registrationStart: string | null; registrationEnd: string | null;
  resultDate: string | null; fee: number | null; location: string | null; url: string | null;
  year: number | null; session: number | null; description: string | null;
  officialExam?: { id: string; examTypeId: string | null; examType?: { id: string; name: string; category: string } | null } | null;
}

interface OfficialExam {
  id: string; name: string; organization: string; category: string;
  examDate: string; registrationStart: string | null; registrationEnd: string | null;
  resultDate: string | null; year: number; session: number | null;
  examTypeId?: string | null;
  examType?: { id: string; name: string; category: string } | null;
}

interface SharedResource {
  id: string; title: string; url: string | null; description: string | null;
  type: string; createdAt: string;
  user: { id: string; name: string | null; image: string | null; username: string | null };
}


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

  // 커뮤니티 공유 자료
  const [sharedResources, setSharedResources] = useState<SharedResource[]>([]);
  const [examTypeForSubject, setExamTypeForSubject] = useState<{ id: string; name: string; category: string } | null>(null);
  const [shareDialog, setShareDialog] = useState(false);
  const [shareForm, setShareForm] = useState({ title: "", url: "", description: "", type: "link" });
  const [sharing, setSharing] = useState(false);

  // 시험 결과 입력 다이얼로그
  const [examDialog, setExamDialog] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examForm, setExamForm] = useState({
    name: "", examDate: "", actualScore: "", targetScore: "", passScore: "",
    status: "upcoming", memo: "", officialExamId: "",
    organization: "", category: "자격증", year: String(new Date().getFullYear()), session: "",
    registrationStart: "", registrationEnd: "", resultDate: "",
    fee: "", location: "", url: "", description: "",
  });

  // 공식 시험 검색
  const [officialQ, setOfficialQ] = useState("");
  const [officialSuggestions, setOfficialSuggestions] = useState<OfficialExam[]>([]);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [showSugg, setShowSugg] = useState(false);

  async function searchOfficials(q: string) {
    setOfficialQ(q);
    if (!q.trim()) { setOfficialSuggestions([]); setShowSugg(false); return; }
    setOfficialLoading(true);
    try {
      const res = await fetch(`/api/official-exams?q=${encodeURIComponent(q)}`);
      if (res.ok) { setOfficialSuggestions(await res.json()); setShowSugg(true); }
    } finally { setOfficialLoading(false); }
  }

  function applyOfficial(o: OfficialExam) {
    setExamForm(f => ({
      ...f,
      name: o.name,
      examDate: o.examDate?.slice(0, 10) ?? "",
      officialExamId: o.id,
      organization: o.organization,
      category: o.category,
      year: o.year?.toString() ?? "",
      session: o.session?.toString() ?? "",
      registrationStart: o.registrationStart ?? "",
      registrationEnd: o.registrationEnd ?? "",
      resultDate: o.resultDate ?? "",
    }));
    setOfficialQ(o.name);
    setShowSugg(false);
  }

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
      const subjectExams = all.filter(e => e.subjectId === id);
      setExams(subjectExams);

      // 연결된 OfficialExam에서 ExamType 추출
      const examType = subjectExams
        .map(e => e.officialExam?.examType)
        .find(et => et != null) ?? null;
      setExamTypeForSubject(examType ?? null);

      // 시험 종류가 있으면 공유 자료 로드
      if (examType?.id) {
        const sharedRes = await fetch(`/api/study/shared-resources?examTypeId=${examType.id}`);
        if (sharedRes.ok) setSharedResources(await sharedRes.json());
      }
    }
  }

  async function submitSharedResource() {
    if (!shareForm.title.trim() || !examTypeForSubject) return;
    setSharing(true);
    try {
      const res = await fetch("/api/study/shared-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...shareForm, examTypeId: examTypeForSubject.id }),
      });
      if (!res.ok) throw new Error();
      toast.success("커뮤니티에 자료가 공유되었습니다.");
      setShareDialog(false);
      setShareForm({ title: "", url: "", description: "", type: "link" });
      // 공유 자료 목록 갱신
      const sharedRes = await fetch(`/api/study/shared-resources?examTypeId=${examTypeForSubject.id}`);
      if (sharedRes.ok) setSharedResources(await sharedRes.json());
    } catch {
      toast.error("공유 실패");
    } finally {
      setSharing(false);
    }
  }

  async function deleteSharedResource(resourceId: string) {
    if (!confirm("이 공유 자료를 삭제할까요?")) return;
    const res = await fetch(`/api/study/shared-resources/${resourceId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("삭제되었습니다.");
      setSharedResources(prev => prev.filter(r => r.id !== resourceId));
    } else {
      toast.error("삭제 실패");
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

  function openAddExam() {
    setEditingExam(null);
    setExamForm({
      name: "", examDate: "", actualScore: "", targetScore: "", passScore: "",
      status: "upcoming", memo: "", officialExamId: "",
      organization: "", category: "자격증", year: String(new Date().getFullYear()), session: "",
      registrationStart: "", registrationEnd: "", resultDate: "",
      fee: "", location: "", url: "", description: "",
    });
    setOfficialQ("");
    setOfficialSuggestions([]);
    setShowSugg(false);
    setExamDialog(true);
  }

  function openEditExam(exam: Exam) {
    setEditingExam(exam);
    setExamForm({
      name: exam.name,
      examDate: exam.examDate?.slice(0, 10) ?? "",
      actualScore: exam.actualScore?.toString() ?? "",
      targetScore: exam.targetScore?.toString() ?? "",
      passScore: exam.passScore?.toString() ?? "",
      status: exam.status,
      memo: exam.memo ?? "",
      officialExamId: exam.officialExamId ?? "",
      organization: exam.organization ?? "",
      category: exam.category ?? "자격증",
      year: exam.year?.toString() ?? String(new Date().getFullYear()),
      session: exam.session?.toString() ?? "",
      registrationStart: exam.registrationStart ?? "",
      registrationEnd: exam.registrationEnd ?? "",
      resultDate: exam.resultDate ?? "",
      fee: exam.fee?.toString() ?? "",
      location: exam.location ?? "",
      url: exam.url ?? "",
      description: exam.description ?? "",
    });
    setOfficialQ(exam.name);
    setOfficialSuggestions([]);
    setShowSugg(false);
    setExamDialog(true);
  }

  async function saveExam() {
    if (!examForm.name || !examForm.examDate) return;
    const payload = {
      name: examForm.name,
      examDate: examForm.examDate,
      category: examForm.category || null,
      subjectId: id,
      actualScore: examForm.actualScore ? Number(examForm.actualScore) : null,
      targetScore: examForm.targetScore ? Number(examForm.targetScore) : null,
      passScore: examForm.passScore ? Number(examForm.passScore) : null,
      memo: examForm.memo || null,
      status: examForm.status,
      officialExamId: examForm.officialExamId || null,
      organization: examForm.organization || null,
      registrationStart: examForm.registrationStart || null,
      registrationEnd: examForm.registrationEnd || null,
      resultDate: examForm.resultDate || null,
      fee: examForm.fee ? Number(examForm.fee) : null,
      location: examForm.location || null,
      url: examForm.url || null,
      year: examForm.year ? Number(examForm.year) : null,
      session: examForm.session ? Number(examForm.session) : null,
      description: examForm.description || null,
    };
    const url = editingExam ? `/api/study/exams/${editingExam.id}` : "/api/study/exams";
    const method = editingExam ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success(editingExam ? "수정되었습니다." : "시험 기록이 추가되었습니다.");
    setExamDialog(false);
    load();
  }

  async function deleteExam(examId: string) {
    if (!confirm("이 시험을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/study/exams/${examId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
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

  // D-day: 시험 기록 우선, 없으면 subject.examDate 폴백
  const nearestUpcomingExam = [...exams]
    .filter(e => new Date(e.examDate) >= new Date())
    .sort((a, b) => a.examDate.localeCompare(b.examDate))[0];
  const dDayBase = nearestUpcomingExam?.examDate ?? subject.examDate;
  const dDay = dDayBase
    ? Math.ceil((new Date(dDayBase).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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
          {dDayBase && (
            <p className="text-sm mt-1 flex items-center gap-1.5 font-medium">
              <CalendarClock className="w-4 h-4 text-orange-500" />
              {nearestUpcomingExam ? nearestUpcomingExam.name : "시험일"}: {formatDate(dDayBase)}
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
            <Button size="sm" onClick={openAddExam}>
              <Plus className="w-3.5 h-3.5 mr-1" /> 시험 추가
            </Button>
          </div>
          {exams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>시험 기록이 없습니다.</p>
            </div>
          ) : (
            exams.map(e => {
              const STATUS_MAP: Record<string, string> = { upcoming: "준비중", passed: "합격", failed: "불합격", cancelled: "취소", preparing: "준비중" /* 구버전 호환 */ };
              return (
              <div key={e.id} className="p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openEditExam(e)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{e.name}</span>
                      <Badge variant={e.status === "passed" ? "default" : "secondary"} className="text-xs">
                        {STATUS_MAP[e.status] ?? e.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{e.examDate?.slice(0, 10)}</p>
                    {e.actualScore != null && (
                      <div className="flex gap-3 mt-1 text-sm">
                        <span>실제: <strong>{e.actualScore}점</strong></span>
                        {e.targetScore && <span className="text-muted-foreground">목표: {e.targetScore}점</span>}
                        {e.passScore && <span className={e.actualScore >= e.passScore ? "text-green-500" : "text-red-500"}>
                          합격선: {e.passScore}점 {e.actualScore >= e.passScore ? <CheckCircle className="inline w-3.5 h-3.5" /> : "✗"}
                        </span>}
                      </div>
                    )}
                    {e.memo && <p className="text-xs text-muted-foreground mt-1">{e.memo}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent" onClick={(ev) => { ev.stopPropagation(); openEditExam(e); }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-destructive" onClick={(ev) => { ev.stopPropagation(); deleteExam(e.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </TabsContent>

        {/* 자료 링크 탭 */}
        <TabsContent value="sources" className="mt-4 space-y-4">
          {/* ── 내 자료 ── */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-muted-foreground">내 자료</p>
              <Button size="sm" onClick={() => setSourceDialog(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> 자료 추가
              </Button>
            </div>
            {sources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="w-7 h-7 mx-auto mb-2 opacity-30" />
                <p className="text-sm">등록된 자료가 없습니다.</p>
                <p className="text-xs mt-1">강의 링크나 참고 자료를 추가해보세요.</p>
              </div>
            ) : (
              sources.map(s => (
                <div key={s.id} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{{ link: "🔗 링크", youtube: "▶️ 유튜브", book: "📗 교재", note: "📝 메모" }[s.type] ?? s.type}</span>
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
          </div>

          {/* ── 커뮤니티 공유 자료 (examType 연결 시만 표시) ── */}
          {examTypeForSubject && (
            <div className="space-y-3">
              <div className="border-t pt-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm font-medium">
                    <span className="text-emerald-600 dark:text-emerald-400">{examTypeForSubject.name}</span> 커뮤니티 자료
                  </p>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {sharedResources.length}개
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShareDialog(true)}>
                  <Share2 className="w-3.5 h-3.5 mr-1" /> 공유하기
                </Button>
              </div>

              {sharedResources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                  <Share2 className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">아직 공유된 자료가 없습니다.</p>
                  <p className="text-xs mt-1">첫 번째로 유용한 자료를 공유해보세요!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sharedResources.map(r => (
                    <div key={r.id} className="p-3 border rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start gap-2">
                        <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                          {{ link: "🔗 링크", youtube: "▶️ 유튜브", book: "📗 교재", note: "📝 메모" }[r.type] ?? r.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{r.title}</p>
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline mt-0.5 flex items-center gap-1 truncate">
                              <ExternalLink className="w-3 h-3 shrink-0" />{r.url}
                            </a>
                          )}
                          {r.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              {r.user.username ?? r.user.name ?? "익명"} · {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                            </span>
                            <button
                              onClick={() => deleteSharedResource(r.id)}
                              className="text-[10px] text-destructive/60 hover:text-destructive ml-auto"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                  {ACTIVITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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

      {/* 커뮤니티 자료 공유 다이얼로그 */}
      <Dialog open={shareDialog} onOpenChange={setShareDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-emerald-500" />
              {examTypeForSubject?.name} 커뮤니티에 공유
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs mb-1 font-medium">유형</p>
              <Select value={shareForm.type} onValueChange={v => v && setShareForm(f => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <span>{{ link: "🔗 링크", youtube: "▶️ 유튜브", book: "📗 교재", note: "📝 메모" }[shareForm.type] ?? shareForm.type}</span>
                </SelectTrigger>
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
              <Input
                value={shareForm.title}
                onChange={e => setShareForm(f => ({ ...f, title: e.target.value }))}
                placeholder="예: 빅데이터분석기사 합격 후기 + 추천 강의"
              />
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">URL (선택)</p>
              <Input
                value={shareForm.url}
                onChange={e => setShareForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <p className="text-xs mb-1 font-medium">설명 (선택)</p>
              <Textarea
                value={shareForm.description}
                onChange={e => setShareForm(f => ({ ...f, description: e.target.value }))}
                placeholder="자료에 대한 간단한 설명을 남겨주세요..."
                className="h-20 resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialog(false)}>취소</Button>
            <Button onClick={submitSharedResource} disabled={sharing || !shareForm.title.trim()}>
              {sharing && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              공유하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 시험 추가/수정 다이얼로그 */}
      <Dialog open={examDialog} onOpenChange={setExamDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingExam ? "시험 수정" : "시험 일정 추가"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* 공식 시험 검색 */}
            <div>
              <p className="text-xs mb-1 font-medium">공식 시험 검색 <span className="text-muted-foreground font-normal">(선택)</span></p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={officialQ}
                  onChange={e => searchOfficials(e.target.value)}
                  onFocus={() => officialSuggestions.length > 0 && setShowSugg(true)}
                  placeholder="시험 이름으로 검색..."
                  className="pl-8 pr-8 text-sm"
                />
                {officialLoading && <Loader2 className="absolute right-2.5 top-2.5 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>
              {showSugg && officialSuggestions.length > 0 && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-background shadow-sm z-10 relative">
                  {officialSuggestions.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => applyOfficial(o)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b last:border-b-0"
                    >
                      <p className="text-sm font-medium">{o.name}</p>
                      <p className="text-xs text-muted-foreground">{o.organization} · {o.examDate?.slice(0, 10)}</p>
                    </button>
                  ))}
                </div>
              )}
              {showSugg && officialSuggestions.length === 0 && !officialLoading && officialQ.trim() && (
                <p className="text-xs text-muted-foreground mt-1 px-1">검색 결과가 없습니다. 직접 입력해주세요.</p>
              )}
              {examForm.officialExamId && (
                <p className="text-xs text-blue-600 mt-1 px-1">✓ 공식 시험과 연결됨</p>
              )}
            </div>

            <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 border-t" />
              <span>시험 정보 입력</span>
              <div className="flex-1 border-t" />
            </div>

            {/* 관리자 폼과 동일한 필드 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <p className="text-xs mb-1 font-medium">시험명 *</p>
                <Input value={examForm.name} onChange={e => setExamForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 정보처리기사 필기" />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">주관기관</p>
                <Input value={examForm.organization} onChange={e => setExamForm(f => ({ ...f, organization: e.target.value }))} placeholder="한국산업인력공단" />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">카테고리</p>
                <Select value={examForm.category} onValueChange={v => v && setExamForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["자격증","어학","TOPCIT","공무원","대학시험","기타"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">연도</p>
                <Input type="number" value={examForm.year} onChange={e => setExamForm(f => ({ ...f, year: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">회차</p>
                <Input type="number" value={examForm.session} onChange={e => setExamForm(f => ({ ...f, session: e.target.value }))} placeholder="1" />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">시험일 *</p>
                <Input type="date" value={examForm.examDate} onChange={e => setExamForm(f => ({ ...f, examDate: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">결과 발표일</p>
                <Input type="date" value={examForm.resultDate} onChange={e => setExamForm(f => ({ ...f, resultDate: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">접수 시작일</p>
                <Input type="date" value={examForm.registrationStart} onChange={e => setExamForm(f => ({ ...f, registrationStart: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">접수 마감일</p>
                <Input type="date" value={examForm.registrationEnd} onChange={e => setExamForm(f => ({ ...f, registrationEnd: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">응시료 (원)</p>
                <Input type="number" value={examForm.fee} onChange={e => setExamForm(f => ({ ...f, fee: e.target.value }))} placeholder="20000" />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">시험 장소</p>
                <Input value={examForm.location} onChange={e => setExamForm(f => ({ ...f, location: e.target.value }))} placeholder="전국" />
              </div>
              <div className="col-span-2">
                <p className="text-xs mb-1 font-medium">공식 URL</p>
                <Input value={examForm.url} onChange={e => setExamForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="col-span-2">
                <p className="text-xs mb-1 font-medium">설명</p>
                <Input value={examForm.description} onChange={e => setExamForm(f => ({ ...f, description: e.target.value }))} placeholder="시험 관련 메모" />
              </div>
            </div>

            <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 border-t" />
              <span>내 시험 정보</span>
              <div className="flex-1 border-t" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1 font-medium">상태</p>
                <Select value={examForm.status} onValueChange={v => v && setExamForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-9 text-xs">
                    <span>{{ upcoming:"준비중", passed:"합격", failed:"불합격", cancelled:"취소" }[examForm.status] ?? "준비중"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">준비중</SelectItem>
                    <SelectItem value="passed">합격</SelectItem>
                    <SelectItem value="failed">불합격</SelectItem>
                    <SelectItem value="cancelled">취소</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">목표 점수</p>
                <Input type="number" value={examForm.targetScore} placeholder="선택"
                  onChange={e => setExamForm(f => ({ ...f, targetScore: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">합격 기준</p>
                <Input type="number" value={examForm.passScore} placeholder="선택"
                  onChange={e => setExamForm(f => ({ ...f, passScore: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs mb-1 font-medium">실제 점수</p>
                <Input type="number" value={examForm.actualScore} placeholder="선택"
                  onChange={e => setExamForm(f => ({ ...f, actualScore: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <p className="text-xs mb-1 font-medium">메모</p>
                <Input value={examForm.memo} placeholder="시험장, 준비 사항 등..."
                  onChange={e => setExamForm(f => ({ ...f, memo: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamDialog(false)}>취소</Button>
            <Button onClick={saveExam} disabled={!examForm.name || !examForm.examDate}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
