"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface ExamType {
  id: string;
  name: string;
  category: string;
}

interface OfficialExam {
  id: string;
  examTypeId: string | null;
  name: string;
  organization: string;
  category: string;
  examDate: string;
  registrationStart: string | null;
  registrationEnd: string | null;
  resultDate: string | null;
  fee: number | null;
  location: string | null;
  description: string | null;
  url: string | null;
  year: number;
  session: number | null;
  isActive: boolean;
  examType?: ExamType | null;
}

const EMPTY_FORM = {
  name: "", organization: "", category: "자격증",
  examDate: "", registrationStart: "", registrationEnd: "",
  resultDate: "", fee: "", location: "", description: "",
  url: "", year: String(new Date().getFullYear()), session: "",
  isActive: true, examTypeId: "",
};

const CATEGORIES = ["자격증", "어학", "공무원", "대학시험", "기타"];

export default function AdminExamsPage() {
  const [exams, setExams] = useState<OfficialExam[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OfficialExam | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCat, setFilterCat] = useState("전체");

  async function loadExams() {
    setLoading(true);
    try {
      const [all, types] = await Promise.all([
        fetch("/api/official-exams").then(r => r.json()),
        fetch("/api/admin/exam-types").then(r => r.json()),
      ]);
      setExams(Array.isArray(all) ? all : []);
      setExamTypes(Array.isArray(types) ? types : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadExams(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(exam: OfficialExam) {
    setEditTarget(exam);
    setForm({
      name: exam.name,
      organization: exam.organization,
      category: exam.category,
      examDate: exam.examDate,
      registrationStart: exam.registrationStart ?? "",
      registrationEnd: exam.registrationEnd ?? "",
      resultDate: exam.resultDate ?? "",
      fee: exam.fee != null ? String(exam.fee) : "",
      location: exam.location ?? "",
      description: exam.description ?? "",
      url: exam.url ?? "",
      year: String(exam.year),
      session: exam.session != null ? String(exam.session) : "",
      isActive: exam.isActive,
      examTypeId: exam.examTypeId ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.organization || !form.examDate || !form.year) {
      toast.error("필수 항목을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, fee: form.fee || null, session: form.session || null };
      const res = editTarget
        ? await fetch(`/api/official-exams/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/official-exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      if (!res.ok) throw new Error();
      toast.success(editTarget ? "수정되었습니다." : "등록되었습니다.");
      setOpen(false);
      await loadExams();
    } catch {
      toast.error("저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 시험 일정을 삭제할까요?`)) return;
    const res = await fetch(`/api/official-exams/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("삭제되었습니다."); await loadExams(); }
    else toast.error("삭제 실패");
  }

  const filtered = filterCat === "전체" ? exams : exams.filter(e => e.category === filterCat);

  return (
    <div className="min-h-screen bg-background p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">공식 시험 일정 관리</h1>
          <p className="text-sm text-muted-foreground">관리자 전용 — 공식 시험 일정 등록/수정/삭제</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/exam-types">
            <Button variant="outline" size="sm">
              <BookOpen className="w-4 h-4 mr-1" /> 시험 종류 관리
            </Button>
          </Link>
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" /> 시험 추가
          </Button>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 flex-wrap">
        {["전체", ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1 rounded-full text-sm transition-colors border ${
              filterCat === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">등록된 시험이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exam => (
            <Card key={exam.id} className={!exam.isActive ? "opacity-50" : ""}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{exam.name}</span>
                    <Badge variant="outline" className="text-xs">{exam.category}</Badge>
                    {exam.session && <Badge variant="secondary" className="text-xs">{exam.session}회차</Badge>}
                    {exam.examType && (
                      <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0">
                        {exam.examType.name}
                      </Badge>
                    )}
                    {!exam.isActive && <Badge variant="destructive" className="text-xs">비활성</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                    <span>{exam.organization}</span>
                    <span>시험일: {exam.examDate}</span>
                    {exam.registrationStart && <span>접수: {exam.registrationStart} ~ {exam.registrationEnd}</span>}
                    {exam.fee && <span>응시료: {exam.fee.toLocaleString()}원</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exam)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(exam.id, exam.name)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "시험 수정" : "공식 시험 등록"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <p className="text-xs font-medium">시험명 *</p>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="빅데이터분석기사" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">주관기관 *</p>
              <Input value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} placeholder="한국데이터산업진흥원" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">카테고리 *</p>
              <Select value={form.category} onValueChange={v => v && setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9"><span>{form.category}</span></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">연도 *</p>
              <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">회차</p>
              <Input type="number" value={form.session} onChange={e => setForm(f => ({ ...f, session: e.target.value }))} placeholder="1" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">시험일 *</p>
              <Input type="date" value={form.examDate} onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">결과 발표일</p>
              <Input type="date" value={form.resultDate} onChange={e => setForm(f => ({ ...f, resultDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">접수 시작일</p>
              <Input type="date" value={form.registrationStart} onChange={e => setForm(f => ({ ...f, registrationStart: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">접수 마감일</p>
              <Input type="date" value={form.registrationEnd} onChange={e => setForm(f => ({ ...f, registrationEnd: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">응시료 (원)</p>
              <Input type="number" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} placeholder="20000" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">시험 장소</p>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="전국" />
            </div>
            <div className="col-span-2 space-y-1">
              <p className="text-xs font-medium">공식 URL</p>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="col-span-2 space-y-1">
              <p className="text-xs font-medium">시험 종류 연결</p>
              <Select
                value={form.examTypeId || "_none"}
                onValueChange={v => setForm(f => ({ ...f, examTypeId: v === "_none" ? "" : v }))}
              >
                <SelectTrigger className="h-9">
                  <span>{examTypes.find(t => t.id === form.examTypeId)?.name ?? "연결 안 함"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">연결 안 함</SelectItem>
                  {examTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">시험 종류와 연결하면 해당 종류의 자료 공유 게시판에 표시됩니다.</p>
            </div>
            <div className="col-span-2 space-y-1">
              <p className="text-xs font-medium">설명</p>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {editTarget && (
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm">활성 상태</label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              {editTarget ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
