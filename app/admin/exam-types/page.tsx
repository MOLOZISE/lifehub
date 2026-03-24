"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";

interface ExamType {
  id: string;
  name: string;
  category: string;
  organization: string | null;
  description: string | null;
  isActive: boolean;
  _count: { officialExams: number; sharedResources: number };
}

const CATEGORIES = ["자격증", "어학", "공무원", "대학시험", "기타"];

const EMPTY_FORM = {
  name: "", category: "자격증", organization: "", description: "", isActive: true,
};

export default function AdminExamTypesPage() {
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExamType | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    setLoading(true);
    try {
      const data = await fetch("/api/admin/exam-types").then(r => r.json());
      setExamTypes(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(et: ExamType) {
    setEditTarget(et);
    setForm({
      name: et.name,
      category: et.category,
      organization: et.organization ?? "",
      description: et.description ?? "",
      isActive: et.isActive,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.category) {
      toast.error("시험 종류명과 카테고리는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = editTarget
        ? await fetch(`/api/admin/exam-types/${editTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          })
        : await fetch("/api/admin/exam-types", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
      if (!res.ok) throw new Error();
      toast.success(editTarget ? "수정되었습니다." : "등록되었습니다.");
      setOpen(false);
      await load();
    } catch {
      toast.error("저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 시험 종류를 삭제할까요?\n연결된 시험 일정의 종류 연결이 해제됩니다.`)) return;
    const res = await fetch(`/api/admin/exam-types/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("삭제되었습니다."); await load(); }
    else toast.error("삭제 실패");
  }

  const CATEGORY_COLOR: Record<string, string> = {
    자격증: "bg-blue-100 text-blue-700",
    어학: "bg-green-100 text-green-700",
    공무원: "bg-orange-100 text-orange-700",
    대학시험: "bg-purple-100 text-purple-700",
    기타: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-3xl mx-auto space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/exams" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              시험 종류 관리
            </h1>
            <p className="text-sm text-muted-foreground">공식 시험 종류 등록 — 자료 공유 게시판의 기준이 됩니다</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" /> 종류 추가
        </Button>
      </div>

      {/* 안내 */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
        💡 <strong>시험 종류</strong>는 "빅데이터분석기사", "토익" 같은 시험 자체를 의미합니다.
        <br />
        <strong>시험 일정</strong>은 "빅데이터분석기사 2026년 필기시험" 같은 구체적인 일정입니다.
        <br />
        시험 종류에 연결된 공식 시험 일정이 있어야 사용자가 해당 종류로 자료를 공유할 수 있습니다.
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : examTypes.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">등록된 시험 종류가 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {examTypes.map(et => (
            <Card key={et.id} className={!et.isActive ? "opacity-50" : ""}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{et.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLOR[et.category] ?? "bg-gray-100 text-gray-600"}`}>
                      {et.category}
                    </span>
                    {!et.isActive && <Badge variant="destructive" className="text-xs">비활성</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                    {et.organization && <span>{et.organization}</span>}
                    <span className="text-blue-600 dark:text-blue-400">시험 일정 {et._count.officialExams}개</span>
                    <span className="text-emerald-600 dark:text-emerald-400">공유 자료 {et._count.sharedResources}개</span>
                  </div>
                  {et.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{et.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(et)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(et.id, et.name)}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "시험 종류 수정" : "시험 종류 등록"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <p className="text-xs font-medium">시험 종류명 *</p>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="빅데이터분석기사"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium">카테고리 *</p>
                <Select value={form.category} onValueChange={v => v && setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9"><span>{form.category}</span></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">주관기관</p>
                <Input
                  value={form.organization}
                  onChange={e => setForm(f => ({ ...f, organization: e.target.value }))}
                  placeholder="한국데이터산업진흥원"
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">설명</p>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="간단한 설명 (선택)"
              />
            </div>
            {editTarget && (
              <div className="flex items-center gap-2">
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
