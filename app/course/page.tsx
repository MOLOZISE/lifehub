"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Loader2, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Course {
  id: string; title: string; description?: string;
  theme: string; tags: string[]; isPublic: boolean;
  itemCount: number; createdAt: string; updatedAt: string;
}

const THEMES = [
  { key: "date",    label: "💑 데이트",   color: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300" },
  { key: "family",  label: "👨‍👩‍👧 가족",    color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  { key: "friends", label: "👥 친구",     color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  { key: "solo",    label: "🚶 혼자",     color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
];

function themeInfo(key: string) {
  return THEMES.find(t => t.key === key) ?? THEMES[0];
}

const EMPTY_FORM = { title: "", description: "", theme: "date", tags: "" };

export default function CoursePage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetch("/api/course").then(r => r.json())
      .then(d => setCourses(d.courses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function createCourse() {
    if (!form.title.trim()) { toast.error("제목을 입력해주세요"); return; }
    setCreating(true);
    try {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch("/api/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, description: form.description, theme: form.theme, tags }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "생성 실패"); return; }
      toast.success("코스가 만들어졌어요!");
      router.push(`/course/${data.course.id}`);
    } catch { toast.error("오류가 발생했습니다"); }
    finally { setCreating(false); }
  }

  async function deleteCourse(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("이 코스를 삭제할까요?")) return;
    await fetch(`/api/course/${id}`, { method: "DELETE" });
    setCourses(cs => cs.filter(c => c.id !== id));
    toast.success("삭제됐어요");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🗺️ 내 코스</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(o => !o)}>
          <Plus className="w-4 h-4" />{showCreate ? "닫기" : "새 코스"}
        </Button>
      </div>

      {/* 생성 폼 */}
      {showCreate && (
        <Card className="border-dashed border-2">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">새 코스 만들기</p>
            <Input placeholder="코스 이름 *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") createCourse(); }}
              autoFocus className="h-9 text-sm" />
            <Textarea placeholder="설명 (선택)" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="h-16 text-sm resize-none" />
            <div className="flex flex-wrap gap-1.5">
              {THEMES.map(t => (
                <button key={t.key} type="button"
                  onClick={() => setForm(f => ({ ...f, theme: t.key }))}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border-2 transition-all
                    ${form.theme === t.key ? "border-primary " + t.color : "border-transparent bg-muted/50 text-muted-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <Input placeholder="태그 (쉼표로 구분, 예: 홍대, 저녁)" value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              className="h-9 text-sm" />
            <div className="flex gap-2">
              <Button className="flex-1 h-9" onClick={createCourse} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}만들기
              </Button>
              <Button variant="outline" className="h-9 px-4" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 코스 목록 */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && courses.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <MapPin className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">아직 만든 코스가 없어요</p>
          <p className="text-xs text-muted-foreground">데이트 코스, 가족 나들이 동선을 계획해보세요</p>
          <Button size="sm" onClick={() => setShowCreate(true)} className="mt-1 gap-1.5">
            <Plus className="w-4 h-4" />첫 코스 만들기
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {courses.map(course => {
          const th = themeInfo(course.theme);
          return (
            <Card key={course.id}
              className="cursor-pointer hover:shadow-md transition-all group"
              onClick={() => router.push(`/course/${course.id}`)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${th.color}`}>{th.label}</span>
                    {course.isPublic && <span className="text-[10px] text-muted-foreground">공개</span>}
                  </div>
                  <p className="font-semibold text-sm truncate">{course.title}</p>
                  {course.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{course.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />{course.itemCount}개 장소
                    </span>
                    {course.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={e => deleteCourse(course.id, e)}
                    className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
