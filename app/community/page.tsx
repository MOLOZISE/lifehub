"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Heart, Eye, PenSquare, Loader2, Search, X, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "@/lib/utils-app";

const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "free", label: "🗣️ 자유게시판" },
  { value: "stock", label: "📈 주식토론방" },
  { value: "study", label: "📖 스터디인증" },
  { value: "restaurant", label: "🍜 맛집추천" },
];

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
        <Button onClick={() => router.push("/community/new")} className="gap-2">
          <PenSquare className="w-4 h-4" />
          글쓰기
        </Button>
      </div>

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
        <div className="space-y-2">
          {posts.map((post) => (
            <Link key={post.id} href={`/community/${post.id}`}>
              <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="secondary" className="text-xs shrink-0">
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
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
                </CardContent>
              </Card>
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
    </div>
  );
}

export default function CommunityPage() {
  return <Suspense><CommunityContent /></Suspense>;
}
