"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Heart, MessageSquare, Eye, ArrowLeft, Send, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils-app";

const CATEGORY_LABELS: Record<string, string> = {
  free: "🗣️ 자유게시판",
  stock: "📈 주식토론방",
  study: "📖 스터디인증",
  restaurant: "🍜 맛집추천",
};

type Comment = {
  id: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  user: { id: string; name: string } | null;
  replies: Comment[];
};

type Post = {
  id: string;
  title: string;
  content: string;
  category: string;
  isAnonymous: boolean;
  tags: string[];
  viewCount: number;
  createdAt: string;
  user: { id: string; name: string } | null;
  comments: Comment[];
  _count: { likes: number; comments: number };
};

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [post, setPost] = useState<Post | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/community/posts/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setPost(data.post);
        setIsLiked(data.isLiked);
        setLikeCount(data.post?._count?.likes ?? 0);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleLike() {
    if (!session) { toast.error("로그인이 필요합니다."); return; }
    const res = await fetch(`/api/community/posts/${id}/like`, { method: "POST" });
    const data = await res.json();
    setIsLiked(data.liked);
    setLikeCount(data.count);
  }

  async function handleComment(parentId?: string) {
    if (!session) { toast.error("로그인이 필요합니다."); return; }
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/community/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment, isAnonymous: commentAnon, parentId: parentId ?? null }),
      });
      if (!res.ok) { toast.error("댓글 작성에 실패했습니다."); return; }
      setComment("");
      setReplyTo(null);
      // Refresh post
      const updated = await fetch(`/api/community/posts/${id}`).then((r) => r.json());
      setPost(updated.post);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/community/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("게시글이 삭제됐습니다.");
      router.push("/community");
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!post) {
    return <div className="text-center py-20 text-muted-foreground">게시글을 찾을 수 없습니다.</div>;
  }

  const isAuthor = session?.user?.id === post.user?.id;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2 text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> 목록으로
      </Button>

      {/* 본문 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Badge variant="secondary">{CATEGORY_LABELS[post.category] ?? post.category}</Badge>
              <h1 className="text-xl font-bold">{post.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{post.isAnonymous ? "익명" : post.user?.name ?? "알 수 없음"}</span>
                <span>{formatDistanceToNow(post.createdAt)}</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.viewCount}</span>
              </div>
            </div>
            {isAuthor && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive shrink-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
          {post.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {post.tags.map((tag) => (
                <span key={tag} className="text-xs text-primary">#{tag}</span>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed border-t pt-4">
            {post.content}
          </div>
          {/* 좋아요 */}
          <div className="flex items-center gap-4 pt-2 border-t">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-sm transition-colors ${isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
              좋아요 {likeCount}
            </button>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              댓글 {post._count.comments}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 댓글 목록 */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm">댓글 {post.comments.length}개</h2>
        {post.comments.map((c) => (
          <Card key={c.id} className="border-muted">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.isAnonymous ? "익명" : c.user?.name ?? "알 수 없음"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(c.createdAt)}</span>
                  <button
                    className="text-xs text-muted-foreground hover:text-primary"
                    onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                  >
                    답글
                  </button>
                </div>
              </div>
              <p className="text-sm">{c.content}</p>
              {/* 대댓글 */}
              {c.replies.length > 0 && (
                <div className="ml-4 border-l pl-3 space-y-2">
                  {c.replies.map((r) => (
                    <div key={r.id}>
                      <span className="text-xs font-medium">{r.isAnonymous ? "익명" : r.user?.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{formatDistanceToNow(r.createdAt)}</span>
                      <p className="text-sm mt-0.5">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}
              {/* 답글 입력 */}
              {replyTo === c.id && (
                <div className="ml-4 flex gap-2">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="답글을 입력하세요..."
                    className="text-sm min-h-[60px]"
                  />
                  <Button size="sm" disabled={submitting} onClick={() => handleComment(c.id)}>
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 댓글 작성 */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">댓글 작성</span>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={commentAnon}
                onChange={(e) => setCommentAnon(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              익명
            </label>
          </div>
          <Textarea
            value={replyTo ? "" : comment}
            onChange={(e) => { setReplyTo(null); setComment(e.target.value); }}
            placeholder={session ? "댓글을 입력하세요..." : "로그인 후 댓글을 작성할 수 있습니다."}
            className="min-h-[80px] text-sm"
            disabled={!session}
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={submitting || !session || !comment.trim()} onClick={() => handleComment()}>
              {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
              등록
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
