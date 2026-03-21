"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, Eye, EyeOff, ImageIcon } from "lucide-react";
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

// 유튜브 URL에서 videoId 추출
function extractYoutubeId(text: string): string | null {
  const m = text.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// 이미지 URL 감지
function isImageUrl(text: string): boolean {
  return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(text.trim());
}

// 컨텐츠 렌더링 (미리보기용)
function renderContent(content: string) {
  const parts = content.split(/(\[IMG:[^\]]+\]|\[YT:[A-Za-z0-9_-]{11}\])/g);
  return parts.map((part, i) => {
    const imgMatch = part.match(/^\[IMG:(.+)\]$/);
    if (imgMatch) {
      return (
        <img key={i} src={imgMatch[1]} alt="첨부 이미지"
          className="max-w-full rounded-lg my-2 max-h-96 object-contain" />
      );
    }
    const ytMatch = part.match(/^\[YT:([A-Za-z0-9_-]{11})\]$/);
    if (ytMatch) {
      return (
        <div key={i} className="my-3 aspect-video w-full max-w-xl">
          <iframe
            src={`https://www.youtube.com/embed/${ytMatch[1]}`}
            className="w-full h-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    return <span key={i} className="whitespace-pre-wrap">{part}</span>;
  });
}

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
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function insertAtCursor(marker: string) {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = content.slice(0, start) + marker + content.slice(end);
    setContent(next);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + marker.length;
    }, 0);
  }

  async function uploadImageFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "업로드 실패"); return; }
      insertAtCursor(`\n[IMG:${data.url}]\n`);
      toast.success("이미지가 삽입되었습니다.");
    } catch {
      toast.error("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    // 1. 이미지 파일 붙여넣기 (PC 우클릭 복사, 스크린샷 등)
    const imageItem = Array.from(e.clipboardData.items).find(
      item => item.kind === "file" && item.type.startsWith("image/")
    );
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) await uploadImageFile(file);
      return;
    }

    const text = e.clipboardData.getData("text");
    if (!text) return;
    const trimmed = text.trim();

    // 2. 유튜브 URL → 자동 임베딩
    const ytId = extractYoutubeId(trimmed);
    if (ytId) {
      e.preventDefault();
      insertAtCursor(`\n[YT:${ytId}]\n`);
      toast.success("유튜브 영상이 삽입되었습니다.");
      return;
    }

    // 3. 이미지 URL → 자동 이미지
    if (isImageUrl(trimmed)) {
      e.preventDefault();
      insertAtCursor(`\n[IMG:${trimmed}]\n`);
      toast.success("이미지가 삽입되었습니다.");
      return;
    }
    // 그 외: 기본 붙여넣기
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadImageFile(file);
    e.target.value = "";
  }

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
                  <Button key={cat.value} type="button"
                    variant={category === cat.value ? "default" : "outline"} size="sm"
                    onClick={() => setCategory(cat.value)}>
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* 제목 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">제목</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요" required />
            </div>

            {/* 내용 에디터 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">내용</label>
                <div className="flex items-center gap-1">
                  {/* 이미지 직접 첨부 버튼 */}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  <Button type="button" variant="ghost" size="sm"
                    className="gap-1.5 text-xs h-7" disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}>
                    {uploading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <ImageIcon className="w-3.5 h-3.5" />}
                    {uploading ? "업로드 중..." : "이미지"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm"
                    className="gap-1.5 text-xs h-7" onClick={() => setPreview(p => !p)}>
                    {preview ? <><EyeOff className="w-3.5 h-3.5" /> 편집</> : <><Eye className="w-3.5 h-3.5" /> 미리보기</>}
                  </Button>
                </div>
              </div>

              {preview ? (
                <div className="min-h-[200px] p-3 border rounded-md text-sm bg-muted/30">
                  {content ? renderContent(content) : <span className="text-muted-foreground">내용을 입력하면 여기에 미리보기가 표시됩니다.</span>}
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    💡 이미지를 <strong>복사 후 붙여넣기</strong>하거나 <strong>이미지 버튼</strong>으로 첨부하세요. 유튜브/이미지 URL 붙여넣기도 지원합니다.
                  </p>
                  <Textarea
                    ref={contentRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onPaste={handlePaste}
                    placeholder={`내용을 입력하세요\n\n유튜브 URL을 붙여넣으면 자동으로 영상이 삽입되고,\n이미지 URL(.jpg, .png 등)을 붙여넣으면 이미지가 삽입됩니다.`}
                    className="min-h-[200px] text-sm"
                    required
                  />
                </>
              )}
            </div>

            {/* 태그 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">태그 (최대 5개)</label>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  placeholder="#태그 입력 후 추가"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>추가</Button>
              </div>
              {tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {tags.map((tag) => (
                    <span key={tag}
                      className="text-xs bg-accent px-2 py-0.5 rounded-full cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}>
                      #{tag} ✕
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 익명 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)} className="w-4 h-4" />
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
