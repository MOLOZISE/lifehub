"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User, Pencil, Check, X, Calendar, BookOpen,
  TrendingUp, MessageSquare, LogOut, ShieldCheck, ChevronRight, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { toast } from "sonner";

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  bio: string | null;
  image: string | null;
  createdAt: string;
  role: string;
  birthDate?: string | null;
  birthTime?: string | null;
  gender?: string | null;
}

interface Stats {
  totalStudyMinutes: number;
  totalSessions: number;
  totalPosts: number;
}

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [birthForm, setBirthForm] = useState({ birthDate: "", birthTime: "", gender: "" });
  const [savingBirth, setSavingBirth] = useState(false);

  async function loadProfile() {
    const res = await fetch("/api/user/profile");
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setForm({ name: data.name ?? "", username: data.username ?? "", bio: data.bio ?? "" });
      setBirthForm({ birthDate: data.birthDate ?? "", birthTime: data.birthTime ?? "", gender: data.gender ?? "" });
    }
  }

  async function loadStats() {
    const [sessionsRes, postsRes] = await Promise.allSettled([
      fetch("/api/study/sessions?limit=1000"),
      fetch("/api/community/posts?my=1&limit=1"),
    ]);
    let totalStudyMinutes = 0, totalSessions = 0, totalPosts = 0;
    if (sessionsRes.status === "fulfilled" && sessionsRes.value.ok) {
      const data = await sessionsRes.value.json();
      const sessions = data.sessions ?? data ?? [];
      totalSessions = sessions.length;
      totalStudyMinutes = sessions.reduce((s: number, x: { durationMinutes?: number }) => s + (x.durationMinutes ?? 0), 0);
    }
    if (postsRes.status === "fulfilled" && postsRes.value.ok) {
      const data = await postsRes.value.json();
      totalPosts = data.total ?? 0;
    }
    setStats({ totalStudyMinutes, totalSessions, totalPosts });
  }

  useEffect(() => { loadProfile(); loadStats(); }, []);

  async function handleBirthSave() {
    setSavingBirth(true);
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(birthForm),
    });
    setSavingBirth(false);
    if (!res.ok) { toast.error((await res.json()).error ?? "저장 실패"); return; }
    const updated = await res.json();
    setProfile(p => p ? { ...p, ...updated } : p);
    toast.success("운세 정보가 저장되었습니다.");
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { toast.error((await res.json()).error ?? "저장 실패"); return; }
    const updated = await res.json();
    setProfile(p => p ? { ...p, ...updated } : p);
    setEditing(false);
    toast.success("프로필이 업데이트되었습니다.");
    await update({ name: updated.name });
  }

  if (!profile) return <div className="text-center py-16 text-muted-foreground">불러오는 중...</div>;

  const joinDate = new Date(profile.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const isAdmin = profile.role === "ADMIN";
  const initials = (profile.name?.[0] ?? profile.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      <h1 className="text-xl font-bold">내 정보</h1>

      {/* 프로필 카드 */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {/* 아바타 */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shrink-0 overflow-hidden">
              {profile.image
                ? <img src={profile.image} alt="profile" className="w-full h-full object-cover" />
                : initials
              }
            </div>

            {/* 정보 */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">이름</p>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">닉네임</p>
                    <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="h-8 text-sm" placeholder="영문, 숫자, _" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">한 줄 소개</p>
                    <Input value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleSave} disabled={saving} className="h-8">
                      <Check className="w-3.5 h-3.5 mr-1" />{saving ? "저장 중..." : "저장"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing(false)}>
                      <X className="w-3.5 h-3.5 mr-1" />취소
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="font-bold text-base">{profile.name ?? "이름 없음"}</h2>
                    {isAdmin && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-0">
                        <ShieldCheck className="w-3 h-3 mr-0.5" />관리자
                      </Badge>
                    )}
                  </div>
                  {profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
                  <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
                  {profile.bio && <p className="text-sm mt-1">{profile.bio}</p>}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                    <Calendar className="w-3 h-3" />
                    <span>{joinDate} 가입</span>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs px-2" onClick={() => setEditing(true)}>
                    <Pencil className="w-3 h-3 mr-1" />프로필 수정
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 활동 통계 */}
      {stats && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">활동 요약</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold">{Math.round(stats.totalStudyMinutes / 60)}<span className="text-sm font-normal">h</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">학습 시간</p>
              </div>
              <div>
                <p className="text-xl font-bold">{stats.totalSessions}</p>
                <p className="text-xs text-muted-foreground mt-0.5">학습 세션</p>
              </div>
              <div>
                <p className="text-xl font-bold">{stats.totalPosts}</p>
                <p className="text-xs text-muted-foreground mt-0.5">작성 게시글</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 메뉴 */}
      <Card>
        <CardContent className="p-0">
          {/* 계정 정보 */}
          <div className="px-4 py-3 space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground">계정</p>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">이메일</span>
              <span className="truncate max-w-[200px]">{profile.email}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">로그인 방식</span>
              <Badge variant="outline" className="text-xs">
                {profile.email?.includes("@") ? "이메일" : "카카오"}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">가입일</span>
              <span>{joinDate}</span>
            </div>
          </div>

          <Separator />

          {/* 관리자 메뉴 */}
          {isAdmin && (
            <>
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">관리자</p>
                <Link href="/admin/exams"
                  className="flex items-center justify-between py-2 text-sm hover:text-primary transition-colors">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    공식 시험 일정 관리
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
                <Link href="/admin/gemini-test"
                  className="flex items-center justify-between py-2 text-sm hover:text-primary transition-colors">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-violet-500" />
                    <span>Gemini API 테스트</span>
                    <span className="text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full">NEW</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>
              <Separator />
            </>
          )}

          <Separator />

          {/* 생년월일 설정 */}
          <div className="px-4 py-3 space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground">운세 설정</p>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">생년월일</span>
              <input
                type="date"
                value={birthForm.birthDate}
                onChange={e => setBirthForm(f => ({ ...f, birthDate: e.target.value }))}
                className="text-sm bg-transparent border border-input rounded px-2 py-1 text-right"
              />
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">태어난 시간 <span className="text-xs">(선택)</span></span>
              <input
                type="time"
                value={birthForm.birthTime}
                onChange={e => setBirthForm(f => ({ ...f, birthTime: e.target.value }))}
                className="text-sm bg-transparent border border-input rounded px-2 py-1 text-right"
              />
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">성별 <span className="text-xs">(선택)</span></span>
              <div className="flex gap-1.5">
                {([{ v: "male", l: "남성" }, { v: "female", l: "여성" }] as { v: string; l: string }[]).map(({ v, l }) => (
                  <button key={v}
                    onClick={() => setBirthForm(f => ({ ...f, gender: f.gender === v ? "" : v }))}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${birthForm.gender === v ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:border-foreground"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" className="w-full h-8 text-xs" onClick={handleBirthSave} disabled={savingBirth}>
              {savingBirth ? "저장 중..." : "운세 정보 저장"}
            </Button>
          </div>

          <Separator />

          {/* 로그아웃 */}
          <div className="px-4 py-3">
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors w-full py-1"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
