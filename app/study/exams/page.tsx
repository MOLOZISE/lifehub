"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Trophy, Calendar, Target, BookOpen, Search, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayString, localDateStr } from "@/lib/utils-app";
import { toast } from "sonner";

type ExamStatus = "upcoming" | "passed" | "failed" | "cancelled";
type Tab = "내 시험" | "공식 시험";

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
const OFFICIAL_CATEGORIES = ["전체", "자격증", "어학", "공무원", "대학시험", "기타"];

interface Subject { id: string; name: string; emoji: string; color: string; }

interface Exam {
  id: string; name: string; category: string | null; examDate: string;
  targetScore: number | null; passScore: number | null; actualScore: number | null;
  status: ExamStatus; memo: string | null; createdAt: string;
  subjectId: string | null; subject: Subject | null;
  officialExamId: string | null;
}

interface OfficialExam {
  id: string; name: string; organization: string; category: string;
  examDate: string; registrationStart: string | null; registrationEnd: string | null;
  resultDate: string | null; fee: number | null; location: string | null;
  description: string | null; url: string | null; year: number; session: number | null;
}

const emptyForm = {
  name: "", category: "자격증", examDate: "",
  targetScore: "", passScore: "", memo: "",
  status: "upcoming" as ExamStatus, actualScore: "",
  subjectId: "",
};

export default function ExamsPage() {
  const [tab, setTab] = useState<Tab>("내 시험");
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterSubjectId, setFilterSubjectId] = useState<string>("all");

  // 공식 시험
  const [officialExams, setOfficialExams] = useState<OfficialExam[]>([]);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [officialCat, setOfficialCat] = useState("전체");
  const [officialQ, setOfficialQ] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  // 이미 내 일정에 추가된 officialExamId 세트
  const addedIds = new Set(exams.map(e => e.officialExamId).filter(Boolean));

  const today = todayString();

  async function loadAll() {
    const [examRes, subRes] = await Promise.all([
      fetch("/api/study/exams"),
      fetch("/api/study/subjects"),
    ]);
    if (examRes.ok) setExams(await examRes.json());
    if (subRes.ok) setSubjects(await subRes.json());
    setLoading(false);
  }

  async function loadOfficialExams() {
    setOfficialLoading(true);
    const params = new URLSearchParams();
    if (officialCat !== "전체") params.set("category", officialCat);
    if (officialQ.trim()) params.set("q", officialQ.trim());
    const res = await fetch(`/api/official-exams?${params}`);
    if (res.ok) setOfficialExams(await res.json());
    setOfficialLoading(false);
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (tab === "공식 시험") loadOfficialExams(); }, [tab, officialCat]);

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
      subjectId: exam.subjectId ?? "",
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
      subjectId: form.subjectId || null,
    };
    const url = editing ? `/api/study/exams/${editing.id}` : "/api/study/exams";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { toast.error("저장 실패"); return; }
    toast.success(editing ? "수정되었습니다." : "시험이 추가되었습니다.");
    setDialogOpen(false);
    loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 시험을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/study/exams/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    setExams(e => e.filter(x => x.id !== id));
  }

  async function handleAddOfficial(official: OfficialExam) {
    setAddingId(official.id);
    try {
      const res = await fetch(`/api/official-exams/${official.id}/add`, { method: "POST" });
      if (res.status === 409) { toast.info("이미 내 일정에 추가된 시험입니다."); return; }
      if (!res.ok) throw new Error();
      toast.success(`"${official.name}"을(를) 내 일정에 추가했습니다.`);
      await loadAll(); // addedIds 갱신
    } catch {
      toast.error("추가 실패");
    } finally {
      setAddingId(null);
    }
  }

  const filtered = filterSubjectId === "all"
    ? exams
    : filterSubjectId === "none"
    ? exams.filter(e => !e.subjectId)
    : exams.filter(e => e.subjectId === filterSubjectId);

  const active = filtered.filter(e => e.status === "upcoming");
  const past = filtered.filter(e => e.status !== "upcoming");

  const displayedOfficials = officialQ.trim()
    ? officialExams.filter(e => e.name.includes(officialQ) || e.organization.includes(officialQ))
    : officialExams;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">시험 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">D-day 추적 및 목표 점수 관리</p>
        </div>
        {tab === "내 시험" && (
          <Button onClick={openAdd}><Plus className="w-4 h-4 mr-1.5" />시험 추가</Button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b">
        {(["내 시험", "공식 시험"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              tab === t
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── 내 시험 탭 ── */}
      {tab === "내 시험" && (
        <>
          {subjects.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {["all", ...subjects.map(s => s.id), "none"].map(id => {
                const sub = subjects.find(s => s.id === id);
                const label = id === "all" ? "전체" : id === "none" ? "미분류" : `${sub?.emoji} ${sub?.name}`;
                return (
                  <button key={id} onClick={() => setFilterSubjectId(id)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${filterSubjectId === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}

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
                        <Card key={exam.id} className={`border-2 ${urgency} cursor-pointer`} onClick={() => openEdit(exam)}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                {exam.subject && (
                                  <div className="flex items-center gap-1 mb-1">
                                    <BookOpen className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">{exam.subject.emoji} {exam.subject.name}</span>
                                  </div>
                                )}
                                <p className="font-semibold">{exam.name}</p>
                                <p className="text-xs text-muted-foreground">{exam.category}</p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(exam); }}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); handleDelete(exam.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
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
                            {exam.officialExamId && <p className="text-[10px] text-indigo-500">📋 공식 시험 일정</p>}
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
                  <div className="flex gap-2 justify-center mt-3">
                    <Button variant="outline" size="sm" onClick={openAdd}><Plus className="w-3.5 h-3.5 mr-1" />직접 추가</Button>
                    <Button variant="outline" size="sm" onClick={() => setTab("공식 시험")}>📋 공식 시험 찾기</Button>
                  </div>
                </CardContent></Card>
              )}

              {past.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">완료된 시험</h2>
                  <div className="space-y-2">
                    {past.map(exam => (
                      <div key={exam.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openEdit(exam)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{exam.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[exam.status]}`}>{STATUS_LABELS[exam.status]}</span>
                            {exam.subject && <Badge variant="outline" className="text-[10px]">{exam.subject.emoji} {exam.subject.name}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(exam.examDate).toLocaleDateString("ko-KR")}
                            {exam.actualScore != null && ` · 실제 점수: ${exam.actualScore}점`}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(exam); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); handleDelete(exam.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── 공식 시험 탭 ── */}
      {tab === "공식 시험" && (
        <div className="space-y-4">
          {/* 검색 + 카테고리 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="시험명 검색..."
                value={officialQ}
                onChange={e => setOfficialQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loadOfficialExams()}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadOfficialExams}>검색</Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {OFFICIAL_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setOfficialCat(cat)}
                className={`px-3 py-1 rounded-full text-sm transition-colors border ${
                  officialCat === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground"
                }`}>
                {cat}
              </button>
            ))}
          </div>

          {officialLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : displayedOfficials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" />
              등록된 공식 시험이 없습니다.<br />관리자가 시험 일정을 등록하면 여기에 표시됩니다.
            </div>
          ) : (
            <div className="space-y-2">
              {displayedOfficials.map(exam => {
                const isAdded = addedIds.has(exam.id);
                const days = daysUntil(exam.examDate);
                return (
                  <div key={exam.id} className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm">{exam.name}</span>
                        <Badge variant="outline" className="text-xs">{exam.category}</Badge>
                        {exam.session && <Badge variant="secondary" className="text-xs">{exam.session}회차</Badge>}
                        {days > 0 && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            days <= 30 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}>D-{days}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{exam.organization}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        <span>📅 시험일 {exam.examDate}</span>
                        {exam.registrationStart && <span>✏️ 접수 {exam.registrationStart} ~ {exam.registrationEnd}</span>}
                        {exam.fee && <span>💰 {exam.fee.toLocaleString()}원</span>}
                        {exam.location && <span>📍 {exam.location}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {exam.url && (
                        <a href={exam.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="공식 페이지">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {isAdded ? (
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 px-3 py-1.5">
                          <CheckCircle2 className="w-4 h-4" />추가됨
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" disabled={addingId === exam.id} onClick={() => handleAddOfficial(exam)}>
                          {addingId === exam.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                          내 일정 추가
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 수정/추가 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "시험 수정" : "시험 추가"}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><p className="text-xs mb-1 font-medium">시험명 *</p><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 정보처리기사 필기" /></div>
              {subjects.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs mb-1 font-medium">연결 과목 (선택)</p>
                  <Select value={form.subjectId || "none"} onValueChange={v => setForm(f => ({ ...f, subjectId: v === "none" ? "" : (v ?? "") }))}>
                    <SelectTrigger><SelectValue placeholder="과목 선택 (선택사항)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미분류</SelectItem>
                      {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div><p className="text-xs mb-1 font-medium">분류</p>
                <Select value={form.category} onValueChange={v => v && setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><span>{form.category}</span></SelectTrigger>
                  <SelectContent>{CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><p className="text-xs mb-1 font-medium">상태</p>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ExamStatus }))}>
                  <SelectTrigger><span>{STATUS_LABELS[form.status]}</span></SelectTrigger>
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
