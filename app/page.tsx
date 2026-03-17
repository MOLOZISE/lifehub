"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, TrendingUp, Layers, CalendarDays, ArrowRight, Flame, Target, AlertCircle, MessageSquare, Utensils, Heart, Eye, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getSubjects, getStudyLogs, getFlashcards, getHoldings, getExams,
  getDueWrongAnswers, getStudySessions,
} from "@/lib/storage";
import { generateStudyRecommendations, analyzePortfolioRisk } from "@/lib/recommendation";
import { getProfitColor, todayString, COLOR_MAP, formatDistanceToNow } from "@/lib/utils-app";
import type { Subject, StudyLog, Holding, Exam, StudyRecommendation } from "@/lib/types";

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
  const diff = new Date(dateStr).getTime() - new Date(todayString()).getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const PRIORITY_COLORS = {
  high: "border-l-4 border-red-400 bg-red-50 dark:bg-red-950/20",
  medium: "border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/20",
  low: "border-l-4 border-green-400 bg-green-50 dark:bg-green-950/20",
};

export default function DashboardPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [todayLogs, setTodayLogs] = useState<StudyLog[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [dueCards, setDueCards] = useState(0);
  const [exams, setExams] = useState<Exam[]>([]);
  const [dueWrongAnswers, setDueWrongAnswers] = useState(0);
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([]);
  const [recentPosts, setRecentPosts] = useState<CommunityPost[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<RestaurantItem[]>([]);
  const today = todayString();

  useEffect(() => {
    const subs = getSubjects();
    setSubjects(subs);
    setTodayLogs(getStudyLogs(today));
    const h = getHoldings();
    setHoldings(h);
    setExams(getExams().filter(e => e.status === "preparing" && e.examDate >= today));
    setDueWrongAnswers(getDueWrongAnswers().length);
    setRecommendations(generateStudyRecommendations().slice(0, 3));

    // Count due flashcards
    let due = 0;
    subs.forEach(s => {
      const cards = getFlashcards(s.id);
      due += cards.filter(c => c.nextReviewAt.slice(0, 10) <= today).length;
    });
    setDueCards(due);

    // Fetch community + restaurant from DB
    fetch("/api/community/posts?limit=4&sort=latest")
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.posts && setRecentPosts(d.posts));
    fetch("/api/restaurant?limit=4&sort=rating")
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.restaurants && setTopRestaurants(d.restaurants));
  }, [today]);

  const todaySessions = getStudySessions ? (() => {
    try { return getStudySessions(today); } catch { return []; }
  })() : [];

  const totalStudyMin = [
    ...todayLogs.filter(l => l.activityType !== "session"),
    ...todaySessions,
  ].reduce((s, l) => s + l.durationMinutes, 0);

  const totalUSD = holdings.reduce((s, h) => s + toUSD(h), 0);
  const totalCost = holdings.reduce((s, h) => s + costUSD(h), 0);
  const totalProfitPct = totalCost > 0 ? ((totalUSD - totalCost) / totalCost) * 100 : 0;

  const risk = analyzePortfolioRisk(holdings);

  // Nearest exam
  const nearestExam = exams.sort((a, b) => a.examDate.localeCompare(b.examDate))[0];

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
          <Link href="/study/exams">
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
            <p className="text-2xl font-bold">{totalStudyMin}<span className="text-sm font-normal text-muted-foreground ml-1">분</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">복습 대기</span>
            </div>
            <p className="text-2xl font-bold">
              {dueCards + dueWrongAnswers}
              {(dueCards + dueWrongAnswers) > 0 && <Badge variant="destructive" className="ml-2 text-xs">오늘!</Badge>}
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
            <p className={`text-2xl font-bold ${getProfitColor(totalProfitPct)}`}>
              {totalProfitPct >= 0 ? "+" : ""}{totalProfitPct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />오늘의 추천 행동
            </h2>
            <Link href="/study/analytics" className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              전체 분석<ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recommendations.map(rec => (
              <div key={rec.id} className={`rounded-lg p-3 ${PRIORITY_COLORS[rec.priority]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{rec.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                  </div>
                  {rec.actionHref && (
                    <Link href={rec.actionHref} className="text-xs text-primary hover:underline shrink-0">
                      {rec.actionLabel} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <CardContent className="space-y-3">
            {subjects.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-2xl mb-1">📚</p>
                <p className="text-sm">과목을 추가해보세요</p>
                <Link href="/study/subjects" className="text-xs text-primary mt-1 inline-block">과목 추가 →</Link>
              </div>
            ) : (
              subjects.slice(0, 4).map(s => {
                const cards = getFlashcards(s.id);
                const known = cards.filter(c => c.known).length;
                const prog = cards.length > 0 ? (known / cards.length) * 100 : 0;
                const colors = COLOR_MAP[s.color as import("@/lib/types").SubjectColor];
                return (
                  <Link key={s.id} href={`/study/subjects/${s.id}`} className="block">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                      <span className="text-xl">{s.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        {cards.length > 0 && (
                          <div className="mt-1">
                            <Progress value={prog} className={`h-1 [&>div]:${colors.bg}`} />
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{cards.length}카드</span>
                    </div>
                  </Link>
                );
              })
            )}

            {(dueCards > 0 || dueWrongAnswers > 0) && (
              <div className="rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">
                    복습 {dueCards + dueWrongAnswers}개 대기
                  </span>
                </div>
                <div className="flex gap-2">
                  {dueCards > 0 && (
                    <Link href="/study/subjects" className="text-xs text-purple-600 dark:text-purple-400">카드 →</Link>
                  )}
                  {dueWrongAnswers > 0 && (
                    <Link href="/study/wrong-answers" className="text-xs text-red-600 dark:text-red-400">오답 →</Link>
                  )}
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

            {/* Risk warnings */}
            {risk.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">리스크 주의</span>
                </div>
                {risk.warnings.slice(0, 2).map((w, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{w}</p>
                ))}
              </div>
            )}

            {holdings.slice(0, 3).map(h => {
              const rate = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
              return (
                <div key={h.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <span className="text-sm font-medium">{h.name}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">{h.ticker}</span>
                  </div>
                  <span className={`text-sm font-medium ${getProfitColor(rate)}`}>
                    {rate >= 0 ? "+" : ""}{rate.toFixed(2)}%
                  </span>
                </div>
              );
            })}
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
              <Link key={r.id} href={`/restaurant/${r.id}`} className="block">
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors">
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
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">빠른 이동</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/study/sessions", icon: "📝", label: "세션 기록", desc: "집중도/만족도" },
            { href: "/study/analytics", icon: "📊", label: "학습 분석", desc: "추천 행동" },
            { href: "/study/wrong-answers", icon: "❌", label: "오답 노트", desc: "간격 반복" },
            { href: "/portfolio/chart", icon: "📈", label: "차트 분석", desc: "캔들스틱" },
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
