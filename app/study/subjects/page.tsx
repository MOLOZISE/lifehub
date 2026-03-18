"use client";

import { useEffect, useState } from "react";
import { Plus, Search, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SubjectCard } from "@/components/study/SubjectCard";
import { toast } from "sonner";
import type { Subject } from "@/lib/types";

type SortKey = "name" | "createdAt" | "studyTime";

interface ApiSubject extends Subject {
  _count?: { notes: number; flashcards: number; quizQuestions: number };
}
interface SessionData { subjectId: string; durationMinutes: number; }

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, { minutes: number; count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [deleteTarget, setDeleteTarget] = useState<ApiSubject | undefined>();

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiSubject | null>(null);
  const [formData, setFormData] = useState({ name: "", color: "blue", emoji: "📚", examDate: "" });

  async function loadSubjects() {
    const [subRes, sessRes] = await Promise.all([
      fetch("/api/study/subjects"),
      fetch("/api/study/sessions?limit=1000"),
    ]);
    if (subRes.ok) setSubjects(await subRes.json());
    if (sessRes.ok) {
      const data = await sessRes.json();
      const sessions: SessionData[] = data.sessions ?? data ?? [];
      const map: Record<string, { minutes: number; count: number }> = {};
      sessions.forEach(s => {
        if (!map[s.subjectId]) map[s.subjectId] = { minutes: 0, count: 0 };
        map[s.subjectId].minutes += s.durationMinutes;
        map[s.subjectId].count += 1;
      });
      setSessionMap(map);
    }
    setLoading(false);
  }

  useEffect(() => { loadSubjects(); }, []);

  function openAdd() {
    setEditTarget(null);
    setFormData({ name: "", color: "blue", emoji: "📚", examDate: "" });
    setFormOpen(true);
  }

  function openEdit(s: ApiSubject) {
    setEditTarget(s);
    setFormData({
      name: s.name,
      color: s.color,
      emoji: s.emoji ?? "📚",
      examDate: s.examDate ? new Date(s.examDate).toISOString().slice(0, 10) : "",
    });
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
    loadSubjects();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/study/subjects/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    toast.success("삭제되었습니다.");
    setDeleteTarget(undefined);
    loadSubjects();
  }

  const COLORS = ["red","orange","yellow","green","blue","indigo","purple","pink"];
  const EMOJIS = ["📚","✏️","🔬","🧮","💻","🎨","🌏","⚖️","🏥","🏗️","📊","🎵","🧪","📐","🌱","🤖"];

  const filtered = subjects
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ko");
      if (sort === "studyTime") return (sessionMap[b.id]?.minutes ?? 0) - (sessionMap[a.id]?.minutes ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="과목 검색..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
          <SelectTrigger className="w-40"><SortAsc className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">생성일순</SelectItem>
            <SelectItem value="name">이름순</SelectItem>
            <SelectItem value="studyTime">공부 시간순</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />과목 추가</Button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">📚</p>
          <p className="font-medium">{search ? "검색 결과가 없습니다." : "과목이 없습니다"}</p>
          {!search && <p className="text-sm mt-1">새 과목을 추가해보세요!</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(subject => (
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

      {/* Add / Edit dialog */}
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
                {COLORS.map(c => {
                  const bgMap: Record<string, string> = { red:"bg-red-500", orange:"bg-orange-500", yellow:"bg-yellow-500", green:"bg-green-500", blue:"bg-blue-500", indigo:"bg-indigo-500", purple:"bg-purple-500", pink:"bg-pink-500" };
                  return (
                    <button key={c} onClick={() => setFormData(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${bgMap[c]} ${formData.color === c ? "border-foreground scale-110" : "border-transparent"}`} />
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">과목명 *</p>
              <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="예: 정보처리기사" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">시험 날짜</p>
              <Input type="date" value={formData.examDate} onChange={e => setFormData(f => ({ ...f, examDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
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
