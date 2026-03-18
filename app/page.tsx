"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen, TrendingUp, CalendarDays, ArrowRight, Flame,
  AlertCircle, MessageSquare, Utensils, Heart, Eye, Star, Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProfitColor, todayString, formatDistanceToNow } from "@/lib/utils-app";

interface StudySession {
  id: string;
  date: string;
  durationMinutes: number;
  activityType: string;
  subject?: { name: string; emoji: string } | null;
}

interface Subject {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface Holding {
  id: string;
  ticker: string;
  name: string;
  market: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currency: string;
}

interface Exam {
  id: string;
  name: string;
  examDate: string;
  status: string;
}

interface CommunityPost {
  id: string;
  title: string;
  category: string;
  isAnonymous: boolean;
  createdAt: string;
  user: { name: string } | null;
  _count: { likes: number; comments: number };
  viewCount: number;
}

interface RestaurantItem {
  id: string;
  name: string;
  category: string;
  avgRating: number;
  reviewCount: number;
  address: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  free: "🗣️ 자유", stock: "📈 주식", study: "📖 스터디", restaurant: "🍜 맛집",
};

const KRW_TO_USD = 1350;
function toUSD(h: Holding) {
  const v = h.quantity * h.currentPrice;
  return h.currency === "KRW" ? v / KRW_TO_USD : v;
}
function costUSD(h: Holding) {
  const v = h.quantity * h.avgPrice;
  return h.currency === "KRW" ? v / KRW_TO_USD : v;
}

function daysUntil(dateStr: string): number {
  const today = new Date(todayString());
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateStreak(sessions: { date: string }[]): number {
  const dateSet = new Set(sessions.map(s => s.date?.slice(0, 10)));
  let streak = 0;
  const today = new Date();
  while (true) {
    const d = new Date(today);
    d.setDate(d.getDate() - streak);
    const key = d.toISOString().slice(0, 10);
    if (dateSet.has(key)) streak++;
    else break;
  }
  return streak;
}

function getLast14Days(): string[] {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const WEEKLY_GOAL_MINUTES = 600; // 주간 목표 10시간

function getThisWeekMonday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=일, 1=월, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getHeatmapColor(minutes: number): string {
  if (minutes === 0) return "bg-muted";
  if (minutes < 30) return "bg-green-200 dark:bg-green-900";
  if (minutes < 60) return "bg-green-400 dark:bg-green-700";
  if (minutes < 120) return "bg-green-600 dark:bg-green-500";
  return "bg-green-800 dark:bg-green-300";
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [recentPosts, setRecentPosts] = useState<CommunityPost[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<RestaurantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayString();

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/study/sessions?limit=60").then(r => r.ok ? r.json() : null),
      fetch("/api/study/subjects").then(r => r.ok ? r.json() : null),
      fetch("/api/portfolio/holdings").then(r => r.ok ? r.json() : null),
      fetch("/api/study/exams").then(r => r.ok ? r.json() : null),
      fetch("/api/community/posts?limit=4&sort=latest").then(r => r.ok ? r.json() : null),
      fetch("/api/restaurant?limit=4&sort=rating").then(r => r.ok ? r.json() : null),
    ]).then(results => {
      const [sessRes, subRes, holdRes, examRes, postsRes, restRes] = results;
      if (sessRes.status === "fulfilled" && sessRes.value?.sessions) setSessions(sessRes.value.sessions);
      if (subRes.status === "fulfilled" && subRes.value?.subjects) setSubjects(subRes.value.subjects);
      if (holdRes.status === "fulfilled" && Array.isArray(holdRes.value)) setHoldings(holdRes.value);
      if (examRes.status === "fulfilled" && examRes.value?.exams) {
        const upcoming = examRes.value.exams.filter((e: Exam) => e.status === "preparing" && e.examDate >= today);
        setExams(upcoming);
      }
      if (postsRes.status === "fulfilled" && postsRes.value?.posts) setRecentPosts(postsRes.value.posts);
      if (restRes.status === "fulfilled" && restRes.value?.restaurants) setTopRestaurants(restRes.value.restaurants);
      setLoading(false);
    });
  }, [today]);

  const todaySessions = sessions.filter(s => s.date?.slice(0, 10) === today);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  const streak = calculateStreak(sessions);

  const weekMonday = getThisWeekMonday();
  const weeklyMinutes = sessions
    .filter(s => s.date && new Date(s.date) >= weekMonday)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const weeklyGoalPct = Math.min(100, Math.round((weeklyMinutes / WEEKLY_GOAL_MINUTES) * 100));
  const last14 = getLast14Days();
  const sessionDateMap = sessions.reduce<Record<string, number>>((acc, s) => {
    const d = s.date?.slice(0, 10);
    if (d) acc[d] = (acc[d] ?? 0) + s.durationMinutes;
    return acc;
  }, {});

  const totalUSD = holdings.reduce((s, h) => s + toUSD(h), 0);
  const totalCost = holdings.reduce((s, h) => s + costUSD(h), 0);
  const totalProfitPct = totalCost > 0 ? ((totalUSD - totalCost) / totalCost) * 100 : 0;

  const nearestExam = [...exams].sort((a, b) => a.examDate.localeCompare(b.examDate))[0];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">안녕하세요 👋</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        {nearestExam && (
          <Link href="/study/subjects">
            <div className={`text-right px-4 py-2 rounded-xl border-2 cursor-pointer hover:bg-accent transition-colors ${
              daysUntil(nearestExam.examDate) <= 7 ? "border-red-400" : "border-amber-400"
            }`}>
              <p className="text-xs text-muted-foreground">{nearestExam.name}</p>
              <p className={`text-lg font-bold ${daysUntil(nearestExam.examDate) <= 7 ? "text-red-500" : "text-amber-600"}`}>
                D-{Math.max(0, daysUntil(nearestExam.examDate))}
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" />
              <span className="text-xs text-muted-foreground">오늘 학습</span>
            </div>
            <p className="text-2xl font-bold">
              {todayMinutes}
              <span className="text-sm font-normal text-muted-foreground ml-1">분</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">연속 학습</span>
            </div>
            <p className="text-2xl font-bold">
              {streak}
              <span className="text-sm font-normal text-muted-foreground ml-1">일</span>
              {streak >= 3 && <span className="ml-1 text-orange-500">🔥</span>}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">준비 시험</span>
            </div>
            <p className="text-2xl font-bold">{exams.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">포트폴리오</span>
            </div>
            <p className={`text-2xl font-bold ${holdings.length > 0 ? getProfitColor(totalProfitPct) : "text-muted-foreground"}`}>
              {holdings.length > 0 ? `${totalProfitPct >= 0 ? "+" : ""}${totalProfitPct.toFixed(1)}%` : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Study heatmap + streak */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              최근 14일 학습 현황
              {streak > 0 && (
                <Badge variant="secondary" className="gap-1 text-orange-600 bg-orange-100 dark:bg-orange-950">
                  <Flame className="w-3 h-3" />{streak}일 연속
                </Badge>
              )}
            </CardTitle>
            <Link href="/study/subjects" className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              기록 추가<ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1.5 flex-wrap">
            {last14.map(day => {
              const mins = sessionDateMap[day] ?? 0;
              const isToday = day === today;
              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-md ${getHeatmapColor(mins)} ${isToday ? "ring-2 ring-primary" : ""} transition-colors`}
                    title={`${day}: ${mins}분`}
                  />
                  <span className="text-[9px] text-muted-foreground">{day.slice(8)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
            <span>적음</span>
            <div className="flex gap-1">
              {["bg-muted", "bg-green-200 dark:bg-green-900", "bg-green-400 dark:bg-green-700", "bg-green-600 dark:bg-green-500", "bg-green-800 dark:bg-green-300"].map((cls, i) => (
                <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
              ))}
            </div>
            <span>많음</span>
          </div>

          {/* 이번 주 통계 */}
          <div className="mt-4 pt-3 border-t flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>이번 주 <span className="font-semibold text-foreground">{Math.floor(weeklyMinutes / 60)}h {weeklyMinutes % 60}m</span></span>
              <span>오늘 <span className="font-semibold text-foreground">{todayMinutes}분</span></span>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-40">
              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${weeklyGoalPct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{weeklyGoalPct}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Study section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4" />학습 현황
              </CardTitle>
              <Link href="/study/subjects" className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                전체 보기<ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
            ) : subjects.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-2xl mb-1">📚</p>
                <p className="text-sm">과목을 추가해보세요</p>
                <Link href="/study/subjects" className="text-xs text-primary mt-1 inline-block">과목 추가 →</Link>
              </div>
            ) : (
              subjects.slice(0, 4).map(s => (
                <Link key={s.id} href="/study/subjects" className="block">
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                    <span className="text-xl">{s.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}

            {todaySessions.length > 0 && (
              <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 p-3">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1.5">오늘 기록</p>
                <div className="space-y-1">
                  {todaySessions.slice(0, 3).map(s => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[140px]">
                        {s.subject?.emoji} {s.subject?.name ?? s.activityType}
                      </span>
                      <span className="font-medium">{s.durationMinutes}분</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Portfolio section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />포트폴리오
              </CardTitle>
              <Link href="/portfolio" className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                전체 보기<ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
            ) : holdings.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-2xl mb-1">📊</p>
                <p className="text-sm">보유 종목을 추가해보세요</p>
                <Link href="/portfolio" className="text-xs text-primary mt-1 inline-block">포트폴리오 →</Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground">평가금액</p>
                    <p className="font-bold text-sm">${totalUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted text-center">
                    <p className="text-xs text-muted-foreground">수익률</p>
                    <p className={`font-bold text-sm ${getProfitColor(totalProfitPct)}`}>
                      {totalProfitPct >= 0 ? "+" : ""}{totalProfitPct.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {holdings.slice(0, 3).map(h => {
                  const rate = h.avgPrice > 0 ? ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100 : 0;
                  return (
                    <Link key={h.id} href={`/portfolio/stock/${encodeURIComponent(h.ticker)}?market=${h.market}`} className="block">
                      <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-accent transition-colors border-b last:border-0">
                        <div>
                          <span className="text-sm font-medium">{h.name}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">{h.ticker}</span>
                        </div>
                        <span className={`text-sm font-medium ${getProfitColor(rate)}`}>
                          {rate >= 0 ? "+" : ""}{rate.toFixed(2)}%
                        </span>
                      </div>
                    </Link>
                  );
                })}

                {holdings.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">외 {holdings.length - 3}개 종목</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Community + Restaurant widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Community recent posts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />커뮤니티
              </CardTitle>
              <Link href="/community" className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                전체 보기<ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {recentPosts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <p>게시글이 없습니다</p>
                <Link href="/community/new" className="text-xs text-primary mt-1 inline-block">첫 글 작성 →</Link>
              </div>
            ) : recentPosts.map(post => (
              <Link key={post.id} href={`/community/${post.id}`} className="block">
                <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent transition-colors">
                  <Badge variant="secondary" className="text-[9px] px-1 shrink-0 mt-0.5">
                    {CATEGORY_LABELS[post.category] ?? post.category}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-snug">{post.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{post.isAnonymous ? "익명" : post.user?.name ?? "알 수 없음"}</span>
                      <span>{formatDistanceToNow(post.createdAt)}</span>
                      <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{post._count.likes}</span>
                      <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{post.viewCount}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Top restaurants */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Utensils className="w-4 h-4" />맛집
              </CardTitle>
              <Link href="/restaurant" className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                전체 보기<ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {topRestaurants.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <p>등록된 맛집이 없습니다</p>
                <Link href="/restaurant" className="text-xs text-primary mt-1 inline-block">맛집 등록 →</Link>
              </div>
            ) : topRestaurants.map(r => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors">
                <Badge variant="secondary" className="text-[9px] px-1 shrink-0">{r.category}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{r.address}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-medium">{r.avgRating > 0 ? r.avgRating.toFixed(1) : "-"}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">빠른 이동</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/study/subjects", icon: "📚", label: "학습 기록", desc: "과목별 공부 기록" },
            { href: "/study/analytics", icon: "📊", label: "학습 분석", desc: "통계 & 추천" },
            { href: "/portfolio", icon: "📈", label: "포트폴리오", desc: "보유 종목 관리" },
            { href: "/restaurant", icon: "🍜", label: "맛집 지도", desc: "내 맛집 모아보기" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="font-medium text-sm mt-2">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
