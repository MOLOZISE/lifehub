"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Trash2, Wand2, BookOpen, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface StudySource {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

interface SubjectInfo { emoji: string; name: string; }

export default function SourcesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [sources, setSources] = useState<StudySource[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [subRes, srcRes] = await Promise.all([
        fetch(`/api/study/subjects/${id}`),
        fetch(`/api/study/subjects/${id}/sources`),
      ]);
      if (!subRes.ok) { router.push("/study/subjects"); return; }
      const s = await subRes.json();
      setSubject({ emoji: s.emoji, name: s.name });
      if (srcRes.ok) setSources(await srcRes.json());
    }
    load();
  }, [id, router]);

  function openAdd() { setTitle(""); setContent(""); setDialogOpen(true); }

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    const res = await fetch(`/api/study/subjects/${id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, type: "text" }),
    });
    if (!res.ok) { toast.error("저장 실패"); return; }
    const source: StudySource = await res.json();
    setSources(prev => [source, ...prev]);
    setDialogOpen(false);
    toast.success("자료가 저장되었습니다");
  }

  async function handleDelete(sourceId: string) {
    const res = await fetch(`/api/study/subjects/${id}/sources/${sourceId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    setSources(prev => prev.filter(s => s.id !== sourceId));
    toast.success("자료가 삭제되었습니다");
  }

  const generateQuiz = useCallback(async (source: StudySource) => {
    setGenerating(source.id);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: `당신은 교육 전문가입니다. 주어진 학습 자료를 분석하여 퀴즈 문제를 생성합니다.
반드시 아래 JSON 배열 형식만으로 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
[
  {"type":"multiple","question":"질문","options":["A","B","C","D"],"answer":"정답 옵션 텍스트","explanation":"해설"},
  {"type":"ox","question":"진위형 질문","answer":"O","explanation":"해설"},
  {"type":"short","question":"단답형 질문","answer":"정답","explanation":"해설"}
]
5~8개 문제를 생성하세요. multiple은 4개 옵션, ox는 O/X 답변, short는 1~3단어 답변.`,
          userMessage: `다음 자료로 퀴즈를 만들어주세요:\n\n제목: ${source.title}\n\n${source.content}`,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const jsonMatch = data.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("JSON을 파싱할 수 없습니다");
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        type: "multiple" | "ox" | "short";
        question: string;
        options?: string[];
        answer: string;
        explanation: string;
      }>;

      let addedCount = 0;
      for (const q of parsed) {
        const qRes = await fetch(`/api/study/subjects/${id}/quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: q.type,
            question: q.question,
            options: q.options ?? [],
            answer: q.answer,
            explanation: q.explanation || "",
            tags: [source.title],
          }),
        });
        if (qRes.ok) addedCount++;
      }
      toast.success(`${addedCount}개 문제가 퀴즈 뱅크에 추가되었습니다!`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setGenerating(null);
    }
  }, [id]);

  if (!subject) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>{subject.emoji}</span>{subject.name} — 학습 자료
          </h2>
          <p className="text-sm text-muted-foreground">자료를 추가하고 AI로 퀴즈를 자동 생성하세요</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />자료 추가</Button>
      </div>

      {sources.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">자료가 없습니다</p>
          <p className="text-sm mt-1">텍스트, 노트 내용 등을 붙여넣어 AI 퀴즈를 생성해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(s => (
            <Card key={s.id}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold">{s.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(s.createdAt).toLocaleDateString("ko-KR")} · {s.content.length.toLocaleString()}자
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => generateQuiz(s)}
                      disabled={generating === s.id}
                    >
                      {generating === s.id
                        ? <><Loader2 className="w-3 h-3 animate-spin" />생성 중...</>
                        : <><Wand2 className="w-3 h-3" />AI 퀴즈</>}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    >
                      {expandedId === s.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(s.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expandedId === s.id && (
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.content}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>학습 자료 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs mb-1">제목 *</p>
              <Input placeholder="예: 1장 요약, 강의 노트 등" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <p className="text-xs mb-1">내용 * (텍스트, PDF 복사 등)</p>
              <Textarea
                rows={10}
                placeholder="학습 자료 내용을 붙여넣으세요. AI가 이 내용을 바탕으로 퀴즈 문제를 자동 생성합니다."
                value={content}
                onChange={e => setContent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">{content.length.toLocaleString()}자</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!title.trim() || !content.trim()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
