"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare, Heart, Eye, PenSquare, Loader2, Search, X, User,
  ExternalLink, BookOpen, Plus, Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "@/lib/utils-app";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "free", label: "🗣️ 자유게시판" },
  { value: "stock", label: "📈 주식토론방" },
  { value: "study", label: "📖 스터디인증" },
  { value: "restaurant", label: "🍜 맛집추천" },
  { value: "resources", label: "📚 자료공유" },
];

// ── 자료공유 타입 ──────────────────────────────────────────────────────────────
const RESOURCE_TYPES = [
  { value: "link",    label: "🔗 링크",   color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  { value: "youtube", label: "▶️ 유튜브", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  { value: "book",    label: "📗 교재",   color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
  { value: "note",    label: "📝 메모",   color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
];

interface ExamType { id: string; name: string; category: string; }
interface SharedResource {
  id: string; type: string; title: string; url: string | null;
  description: string | null; createdAt: string;
  user: { id: string; name: string | null; username: string | null; image: string | null };
  examType: { id: string; name: string; category: string };
}

function ResourcesView() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeExamTypeId = searchParams.get("examType") ?? "";

  const [resources, setResources] = useState<SharedResource[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ examTypeId: "", type: "link", title: "", url: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/study/shared-resources").then(r => r.json()),
      fetch("/api/exam-types").then(r => r.json()),
    ]).then(([res, et]) => {
      setResources(res);
      setExamTypes((et.examTypes ?? []).filter((t: ExamType & { isActive?: boolean }) => t.isActive !== false));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = activeExamTypeId
    ? resources.filter(r => r.examType.id === activeExamTypeId)
    : resources;

  async function submit() {
    if (!form.examTypeId) { toast.error("시험 종류를 선택해주세요"); return; }
    if (!form.title.trim()) { toast.error("제목을 입력해주세요"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/study/shared-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, title: form.title.trim(), url: form.url.trim() || null, description: form.description.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "등록 실패"); return; }
      setResources(prev => [data, ...prev]);
      setForm({ examTypeId: "", type: "link", title: "", url: "", description: "" });
      setShowForm(false);
      toast.success("자료가 등록됐어요!");
    } catch { toast.error("오류가 발생했습니다"); }
    finally { setSubmitting(false); }
  }

  async function deleteResource(id: string) {
    if (!confirm("이 자료를 삭제할까요?")) return;
    const res = await fetch(`/api/study/shared-resources/${id}`, { method: "DELETE" });
    if (res.ok) { setResources(prev => prev.filter(r => r.id !== id)); toast.success("삭제됐어요"); }
  }

  const rt = (type: string) => RESOURCE_TYPES.find(t => t.value === type) ?? RESOURCE_TYPES[0];

  return (
    <div className="space-y-4">
      {/* 시험 종류 필터 태그 */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => router.push("/community?category=resources")}
          className={`text-xs px-3 py-1 rounded-full border font-medium transition-all
            ${!activeExamTypeId ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50 text-muted-foreground"}`}>
          전체
        </button>
        {examTypes.map(et => (
          <button key={et.id}
            onClick={() => router.push(`/community?category=resources&examType=${et.id}`)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-all
              ${activeExamTypeId === et.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50 text-muted-foreground"}`}>
            {et.name}
          </button>
        ))}
      </div>

      {/* 등록 버튼 / 폼 */}
      {session?.user && (
        showForm ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold">자료 등록</p>

              {/* 시험 종류 선택 */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">시험 종류 *</p>
                <Select value={form.examTypeId} onValueChange={(v: string | null) => setForm(f => ({ ...f, examTypeId: v ?? "" }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <span>{examTypes.find(t => t.id === form.examTypeId)?.name ?? "선택해주세요"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {examTypes.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 유형 */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">유형</p>
                <div className="flex flex-wrap gap-1.5">
                  {RESOURCE_TYPES.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border-2 transition-all
                        ${form.type === t.value ? "border-primary " + t.color : "border-transparent bg-muted/50 text-muted-foreground"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">제목 *</p>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="자료 제목을 입력하세요" className="h-9 text-sm" />
              </div>

              {/* URL */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">URL (선택)</p>
                <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://..." className="h-9 text-sm" />
              </div>

              {/* 설명 */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">설명 (선택)</p>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="자료에 대한 간단한 설명을 남겨주세요..." className="h-16 text-sm resize-none" />
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 h-9" onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}등록
                </Button>
                <Button variant="outline" className="h-9 px-4" onClick={() => setShowForm(false)}>취소</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />자료 등록
          </Button>
        )
      )}

      {/* 자료 목록 */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">아직 등록된 자료가 없어요</p>
          <p className="text-xs mt-1">공부에 도움이 되는 자료를 첫 번째로 공유해보세요!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} className="hover:shadow-sm transition-all">
              <CardContent className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rt(r.type).color}`}>
                      {rt(r.type).label}
                    </span>
                    <button
                      onClick={() => router.push(`/community?category=resources&examType=${r.examType.id}`)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-medium hover:opacity-80 transition-opacity">
                      {r.examType.name}
                    </button>
                  </div>
                  <p className="text-sm font-semibold leading-snug">{r.title}</p>
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{r.user.name ?? r.user.username ?? "익명"}</span>
                    <span>{formatDistanceToNow(r.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-md hover:bg-muted transition-colors">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  )}
                  {session?.user?.id === r.user.id && (
                    <button onClick={() => deleteResource(r.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type Post = {
  id: string;
  title: string;
  content: string;
  category: string;
  isAnonymous: boolean;
  tags: string[];
  viewCount: number;
  createdAt: string;
  user: { id: string; name: string; image: string | null } | null;
  _count: { comments: number; likes: number };
};

function CommunityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const category = searchParams.get("category") ?? "";
  const activeTag = searchParams.get("tag") ?? "";
  const myOnly = searchParams.get("my") === "1";

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [feed, setFeed] = useState<"" | "following">("");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20", sort });
      if (category) params.set("category", category);
      if (activeTag) params.set("tag", activeTag);
      if (search) params.set("search", search);
      if (myOnly) params.set("my", "1");
      if (feed) params.set("feed", feed);
      const res = await fetch(`/api/community/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [category, activeTag, page, search, sort, myOnly, feed]);

  useEffect(() => {
    setPage(1);
  }, [category, activeTag, search, sort, myOnly, feed]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label ?? "전체";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">커뮤니티</h1>
          <p className="text-sm text-muted-foreground mt-1">함께 나누는 학습, 투자, 맛집 이야기</p>
        </div>
        {category !== "resources" && (
          <Button onClick={() => router.push("/community/new")} className="gap-2">
            <PenSquare className="w-4 h-4" />글쓰기
          </Button>
        )}
      </div>

      {/* 자료공유 탭이면 ResourcesView로 */}
      {category === "resources" && (
        <>
          {/* 카테고리 탭만 보여주고 ResourcesView 렌더 */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <Button key={cat.value}
                variant={category === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => router.push(cat.value ? `/community?category=${cat.value}` : "/community")}>
                {cat.label}
              </Button>
            ))}
          </div>
          <ResourcesView />
        </>
      )}

      {category === "resources" ? null : <>

      {/* 검색 + 정렬 */}
      <div className="flex gap-2">
        <form className="flex-1 flex gap-1.5" onSubmit={e => { e.preventDefault(); setSearch(searchInput); }}>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="제목·내용·태그 검색"
              className="pl-8 h-8 text-sm"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(""); setSearch(""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-8 px-3 shrink-0">검색</Button>
        </form>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant={sort === "latest" ? "default" : "outline"} className="h-8 text-xs px-2.5" onClick={() => setSort("latest")}>최신</Button>
          <Button size="sm" variant={sort === "popular" ? "default" : "outline"} className="h-8 text-xs px-2.5" onClick={() => setSort("popular")}>인기</Button>
        </div>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={!myOnly && category === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => router.push(cat.value ? `/community?category=${cat.value}` : "/community")}
          >
            {cat.label}
          </Button>
        ))}
        {session?.user && (
          <>
            <Button
              variant={feed === "following" && !myOnly ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => { setFeed(f => f === "following" ? "" : "following"); router.push("/community"); }}
            >
              팔로잉
            </Button>
            <Button
              variant={myOnly ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(myOnly ? "/community" : "/community?my=1")}
            >
              <User className="w-3.5 h-3.5" />내 글
            </Button>
          </>
        )}
      </div>
      {(search || activeTag) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {search && <span>"{search}" 검색 결과</span>}
          {activeTag && (
            <span className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
              #{activeTag}
              <button onClick={() => router.push(category ? `/community?category=${category}` : "/community")} className="hover:text-primary/70 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <span>{total}건</span>
        </div>
      )}

      {/* 게시글 목록 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>아직 게시글이 없습니다.</p>
          <p className="text-sm mt-1">첫 번째 글을 작성해보세요!</p>
        </div>
      ) : (
        <div className="divide-y rounded-xl border overflow-hidden">
          {posts.map((post) => (
            <Link key={post.id} href={`/community/${post.id}`} className="block hover:bg-accent/30 transition-colors px-3 py-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge variant="secondary" className="text-[10px] shrink-0 h-5">
                      {CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}
                    </Badge>
                    {post.tags.slice(0, 2).map((t) => (
                      <button
                        key={t}
                        onClick={(e) => { e.preventDefault(); router.push(`/community?tag=${encodeURIComponent(t)}`); }}
                        className={`text-xs hover:underline ${activeTag === t ? "text-primary font-medium" : "text-muted-foreground"}`}
                      >#{t}</button>
                    ))}
                  </div>
                  <h3 className="font-medium text-sm leading-snug line-clamp-1">{post.title}</h3>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {post.isAnonymous || !post.user ? (
                  <span>{post.isAnonymous ? "익명" : "알 수 없음"}</span>
                ) : (
                  <button
                    onClick={e => { e.preventDefault(); router.push(`/community/users/${post.user!.id}`); }}
                    className="hover:text-foreground hover:underline transition-colors"
                  >
                    {post.user.name}
                  </button>
                )}
                <span>{formatDistanceToNow(post.createdAt)}</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.viewCount}</span>
                <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post._count.likes}</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post._count.comments}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>이전</Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            {page} / {Math.ceil(total / 20)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>다음</Button>
        </div>
      )}
      </>}
    </div>
  );
}

export default function CommunityPage() {
  return <Suspense><CommunityContent /></Suspense>;
}
