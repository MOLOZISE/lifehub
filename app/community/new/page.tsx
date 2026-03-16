"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "free", label: "🗣️ 자유게시판" },
  { value: "stock", label: "📈 주식토론방" },
  { value: "study", label: "📖 스터디인증" },
  { value: "restaurant", label: "🍜 맛집추천" },
];

function NewPostForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(searchParams.get("category") ?? "free");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
      setTagInput("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) { toast.error("로그인이 필요합니다."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, category, isAnonymous, tags }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "작성에 실패했습니다."); return; }
      toast.success("게시글이 등록됐습니다.");
      router.push(`/community/${data.post.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2 text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> 돌아가기
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>새 글 작성</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 카테고리 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">카테고리</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat.value}
                    type="button"
                    variant={category === cat.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategory(cat.value)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* 제목 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">제목</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                required
              />
            </div>

            {/* 내용 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">내용</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="내용을 입력하세요"
                className="min-h-[200px]"
                required
              />
            </div>

            {/* 태그 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">태그 (최대 5개)</label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="#태그 입력 후 추가"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>추가</Button>
              </div>
              {tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-accent px-2 py-0.5 rounded-full cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                    >
                      #{tag} ✕
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 익명 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">익명으로 게시</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>취소</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                등록하기
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewPostPage() {
  return <Suspense><NewPostForm /></Suspense>;
}
