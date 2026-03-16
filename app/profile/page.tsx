"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { User, Pencil, Check, X, Calendar, BookOpen, TrendingUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  bio: string | null;
  image: string | null;
  createdAt: string;
}

interface Stats {
  totalStudyMinutes: number;
  totalSessions: number;
  totalFlashcards: number;
  totalPosts: number;
  totalRestaurants: number;
}

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", bio: "" });
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    const res = await fetch("/api/user/profile");
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setForm({ name: data.name ?? "", username: data.username ?? "", bio: data.bio ?? "" });
    }
  }

  async function loadStats() {
    // Load basic stats from available APIs
    const [sessionsRes, postsRes] = await Promise.allSettled([
      fetch("/api/study/sessions?limit=1000"),
      fetch("/api/community/posts?my=1&limit=1"),
    ]);

    let totalStudyMinutes = 0;
    let totalSessions = 0;
    if (sessionsRes.status === "fulfilled" && sessionsRes.value.ok) {
      const data = await sessionsRes.value.json();
      const sessions = data.sessions ?? data ?? [];
      totalSessions = sessions.length;
      totalStudyMinutes = sessions.reduce((s: number, x: { durationMinutes?: number }) => s + (x.durationMinutes ?? 0), 0);
    }

    let totalPosts = 0;
    if (postsRes.status === "fulfilled" && postsRes.value.ok) {
      const data = await postsRes.value.json();
      totalPosts = data.total ?? 0;
    }

    setStats({ totalStudyMinutes, totalSessions, totalFlashcards: 0, totalPosts, totalRestaurants: 0 });
  }

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "저장 실패");
      return;
    }
    const updated = await res.json();
    setProfile(p => p ? { ...p, ...updated } : p);
    setEditing(false);
    toast.success("프로필이 업데이트되었습니다.");
    // Update NextAuth session
    await update({ name: updated.name });
  }

  if (!profile) return <div className="text-center py-16 text-muted-foreground">불러오는 중...</div>;

  const joinDate = new Date(profile.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">프로필</h1>

      {/* Profile card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shrink-0">
              {profile.image
                ? <img src={profile.image} alt="profile" className="w-full h-full rounded-full object-cover" />
                : (profile.name?.[0] ?? profile.email?.[0] ?? "U").toUpperCase()
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">이름</p>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">닉네임 (커뮤니티)</p>
                    <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="h-8" placeholder="영문, 숫자, _ 사용 가능" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">자기소개</p>
                    <Input value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className="h-8" placeholder="한 줄 소개를 입력하세요" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      <Check className="w-3.5 h-3.5 mr-1" />{saving ? "저장 중..." : "저장"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                      <X className="w-3.5 h-3.5 mr-1" />취소
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold">{profile.name ?? "이름 없음"}</h2>
                    {profile.username && <Badge variant="secondary" className="text-xs">@{profile.username}</Badge>}
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setEditing(true)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{profile.email}</p>
                  {profile.bio && <p className="text-sm">{profile.bio}</p>}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
                    <Calendar className="w-3 h-3" />
                    <span>{joinDate} 가입</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">활동 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex justify-center mb-1.5">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-xl font-bold">{Math.round(stats.totalStudyMinutes / 60)}h</p>
                <p className="text-xs text-muted-foreground">총 학습 시간</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-1.5">
                  <BookOpen className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-xl font-bold">{stats.totalSessions}</p>
                <p className="text-xs text-muted-foreground">학습 세션</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-1.5">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-xl font-bold">{stats.totalPosts}</p>
                <p className="text-xs text-muted-foreground">작성 게시글</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-1.5">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-xl font-bold">
                  {session?.user?.id ? <span className="text-sm">활성</span> : "-"}
                </p>
                <p className="text-xs text-muted-foreground">계정 상태</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">계정 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">이메일</span>
            <span>{profile.email}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">로그인 방식</span>
            <Badge variant="outline" className="text-xs">이메일/비밀번호</Badge>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">가입일</span>
            <span>{joinDate}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
