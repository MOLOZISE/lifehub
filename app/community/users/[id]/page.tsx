"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart, MessageSquare, Eye, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "@/lib/utils-app";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  free: "🗣️ 자유", stock: "📈 주식", study: "📖 스터디", restaurant: "🍜 맛집",
};

interface UserProfile {
  id: string;
  name: string | null;
  image: string | null;
  username: string | null;
  bio: string | null;
  createdAt: string;
  isFollowing: boolean;
  _count: { posts: number; followers: number; following: number };
  posts: {
    id: string; title: string; category: string; createdAt: string;
    viewCount: number; _count: { likes: number; comments: number };
  }[];
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch(`/api/community/users/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setProfile(d); })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleFollow() {
    if (!session) { toast.error("로그인이 필요합니다."); return; }
    setToggling(true);
    try {
      const res = await fetch(`/api/community/follow/${id}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => prev ? {
          ...prev,
          isFollowing: data.following,
          _count: {
            ...prev._count,
            followers: prev._count.followers + (data.following ? 1 : -1),
          },
        } : prev);
        toast.success(data.following ? "팔로우했습니다" : "팔로우를 취소했습니다");
      }
    } finally {
      setToggling(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20 text-muted-foreground">불러오는 중...</div>;
  if (!profile) return <div className="flex justify-center py-20 text-muted-foreground">사용자를 찾을 수 없습니다.</div>;

  const isMe = session?.user?.id === id;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" />돌아가기
      </button>

      {/* 프로필 카드 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {profile.image ? (
              <img src={profile.image} alt={profile.name ?? ""} className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground shrink-0">
                {(profile.name ?? "?")[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h1 className="text-lg font-bold">{profile.name ?? "이름 없음"}</h1>
                  {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
                </div>
                {!isMe && session && (
                  <Button
                    size="sm"
                    variant={profile.isFollowing ? "outline" : "default"}
                    onClick={toggleFollow}
                    disabled={toggling}
                    className="shrink-0"
                  >
                    {profile.isFollowing
                      ? <><UserCheck className="w-3.5 h-3.5 mr-1" />팔로잉</>
                      : <><UserPlus className="w-3.5 h-3.5 mr-1" />팔로우</>
                    }
                  </Button>
                )}
              </div>
              {profile.bio && <p className="text-sm mt-2 text-muted-foreground">{profile.bio}</p>}
              <div className="flex gap-4 mt-3 text-sm">
                <span><strong>{profile._count.posts}</strong> <span className="text-muted-foreground">게시글</span></span>
                <span><strong>{profile._count.followers}</strong> <span className="text-muted-foreground">팔로워</span></span>
                <span><strong>{profile._count.following}</strong> <span className="text-muted-foreground">팔로잉</span></span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 게시글 목록 */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">게시글</h2>
        {profile.posts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">아직 게시글이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {profile.posts.map(post => (
              <Link key={post.id} href={`/community/${post.id}`}>
                <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
                  <CardContent className="p-3.5">
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">
                        {CATEGORY_LABELS[post.category] ?? post.category}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{post.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(post.createdAt)}</span>
                          <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{post.viewCount}</span>
                          <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{post._count.likes}</span>
                          <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{post._count.comments}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
