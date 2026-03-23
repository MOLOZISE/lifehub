"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  BookOpen, TrendingUp, CalendarDays, ArrowRight, Flame, CalendarClock,
  AlertCircle, MessageSquare, Utensils, Heart, Eye, Star, Target, Pencil, Check,
  NotebookPen, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProfitColor, todayString, localDateStr, formatDistanceToNow } from "@/lib/utils-app";
import { MarketOverview } from "@/components/market/MarketOverview";

interface StudySession {
  id: string;
  date: string;
  durationMinutes: number;
  activityType: string;
  subject?: { id: string; name: string; emoji: string } | null;
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

interface PlannerEvent {
  id: string; title: string; date: string;
  startTime?: string; isAllDay: boolean; category: string; color: string;
  location?: string;
}
interface PlanGoal { id: string; title: string; done: boolean; }
interface TodayDiary { content: string; mood?: string; }
interface TodayFortune { overall?: string; score?: number; luckyColor?: string; cached?: boolean; }

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
    const key = localDateStr(d);
    if (dateSet.has(key)) streak++;
    else break;
  }
  return streak;
}

const DOW_KO = ["월", "화", "수", "목", "금", "토", "일"];

function getThisWeekDays(): string[] {
  const monday = getThisWeekMonday();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return localDateStr(d);
  });
}

function buildMonthCalendar(yearMonth: string): (string | null)[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);
  // 월요일 시작
  let startDow = firstDay.getDay(); // 0=일
  startDow = startDow === 0 ? 6 : startDow - 1; // 월=0
  const days: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(`${yearMonth}-${String(d).padStart(2, "0")}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const DEFAULT_WEEKLY_GOAL = 600;

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
  if (minutes === 0) return "bg-muted/60";
  if (minutes < 30) return "bg-green-100 dark:bg-green-900/50";
  if (minutes < 60) return "bg-green-300 dark:bg-green-700/60";
  if (minutes < 120) return "bg-green-500/70 dark:bg-green-600/70";
  return "bg-green-600 dark:bg-green-500";
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [recentPosts, setRecentPosts] = useState<CommunityPost[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<RestaurantItem[]>([]);
  const [todayEvents, setTodayEvents] = useState<PlannerEvent[]>([]);
  const [todayGoals, setTodayGoals] = useState<PlanGoal[]>([]);
  const [todayDiary, setTodayDiary] = useState<TodayDiary | null>(null);
  const [todayFortune, setTodayFortune] = useState<TodayFortune | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayChangePct, setDayChangePct] = useState<Record<string, number>>({});
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const goalInputRef = useRef<HTMLInputElement>(null);
  const [monthEvents, setMonthEvents] = useState<Record<string, PlannerEvent[]>>({});
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const today = todayString();

  useEffect(() => {
    const saved = localStorage.getItem("weeklyGoalMinutes");
    if (saved) setWeeklyGoal(Number(saved));
  }, []);

  // 월 이동 시 해당 월 이벤트 재조회
  useEffect(() => {
    const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    if (calMonth === thisMonth) return;
    fetch(`/api/planner/events?month=${calMonth}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.events) {
          const byDate: Record<string, PlannerEvent[]> = {};
          for (const e of data.events as PlannerEvent[]) {
            if (!byDate[e.date]) byDate[e.date] = [];
            byDate[e.date].push(e);
          }
          setMonthEvents(byDate);
        }
      })
      .catch(() => {});
  }, [calMonth]);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/study/sessions?limit=120").then(r => r.ok ? r.json() : null),
      fetch("/api/study/subjects").then(r => r.ok ? r.json() : null),
      fetch("/api/portfolio/holdings").then(r => r.ok ? r.json() : null),
      fetch("/api/study/exams").then(r => r.ok ? r.json() : null),
      fetch("/api/community/posts?limit=4&sort=latest").then(r => r.ok ? r.json() : null),
      fetch("/api/restaurant?limit=4&sort=rating").then(r => r.ok ? r.json() : null),
      fetch(`/api/planner/events?month=${today.slice(0,7)}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/planner/plans?type=day&period=${today}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/planner/diary?date=${today}`).then(r => r.ok ? r.json() : null),
      fetch("/api/planner/fortune?type=daily").then(r => r.ok ? r.json() : null),
    ]).then(results => {
      const [sessRes, subRes, holdRes, examRes, postsRes, restRes, evRes, planRes, diaryRes, fortuneRes] = results;
      if (sessRes.status === "fulfilled" && sessRes.value?.sessions) setSessions(sessRes.value.sessions);
      if (subRes.status === "fulfilled" && Array.isArray(subRes.value)) setSubjects(subRes.value);
      if (holdRes.status === "fulfilled" && Array.isArray(holdRes.value)) {
        const h = holdRes.value as Holding[];
        setHoldings(h);
        // 일일 수익률 fetch
        if (h.length > 0) {
          const tickers = h.map(x => x.market === "KR" ? `${x.ticker}.KS` : x.ticker).join(",");
          fetch(`/api/stock/price?tickers=${encodeURIComponent(tickers)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data?.prices) {
                const pctMap: Record<string, number> = {};
                for (const holding of h) {
                  const key = holding.market === "KR" ? `${holding.ticker}.KS` : holding.ticker;
                  if (data.prices[key]?.changePercent !== undefined) pctMap[holding.ticker] = data.prices[key].changePercent;
                }
                setDayChangePct(pctMap);
              }
            }).catch(() => {});
        }
      }
      if (examRes.status === "fulfilled" && Array.isArray(examRes.value)) {
        const upcoming = examRes.value.filter((e: Exam) => e.status !== "completed" && e.status !== "passed" && e.examDate >= today);
        setExams(upcoming);
      }
      if (postsRes.status === "fulfilled" && postsRes.value?.posts) setRecentPosts(postsRes.value.posts);
      if (restRes.status === "fulfilled" && restRes.value?.restaurants) setTopRestaurants(restRes.value.restaurants);
      if (evRes.status === "fulfilled" && evRes.value?.events) {
        const evs = evRes.value.events as PlannerEvent[];
        setTodayEvents(evs.filter(e => e.date === today));
        const byDate: Record<string, PlannerEvent[]> = {};
        for (const e of evs) {
          if (!byDate[e.date]) byDate[e.date] = [];
          byDate[e.date].push(e);
        }
        setMonthEvents(byDate);
      }
      if (planRes.status === "fulfilled" && planRes.value?.plan?.goals) {
        setTodayGoals(planRes.value.plan.goals);
      }
      if (diaryRes.status === "fulfilled" && diaryRes.value?.entry?.content) {
        setTodayDiary({ content: diaryRes.value.entry.content, mood: diaryRes.value.entry.mood });
      }
      if (fortuneRes.status === "fulfilled" && fortuneRes.value?.cached) {
        setTodayFortune(fortuneRes.value);
      }
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
  const weeklyGoalPct = Math.min(100, Math.round((weeklyMinutes / weeklyGoal) * 100));

  const sessionDateMap = sessions.reduce<Record<string, number>>((acc, s) => {
    const d = s.date?.slice(0, 10);
    if (d) acc[d] = (acc[d] ?? 0) + s.durationMinutes;
    return acc;
  }, {});

  // subjects fallback: sessions에 포함된 subject 정보로 보완
  const effectiveSubjects: Subject[] = subjects.length > 0 ? subjects : Array.from(
    sessions.reduce<Map<string, Subject>>((map, s) => {
      if (s.subject && !map.has(s.subject.id)) {
        map.set(s.subject.id, { id: s.subject.id, name: s.subject.name, emoji: s.subject.emoji ?? "", color: "blue" });
      }
      return map;
    }, new Map()).values()
  );

  // 과목별 이번 주 누적 시간
  const weekStart = localDateStr(weekMonday);
  const subjectWeekMinutes: Record<string, number> = {};
  for (const s of sessions) {
    if (s.subject && s.date >= weekStart) {
      subjectWeekMinutes[s.subject.id] = (subjectWeekMinutes[s.subject.id] ?? 0) + s.durationMinutes;
    }
  }

  // 과목별 이번 달 누적 시간
  const subjectMonthMinutes: Record<string, number> = {};
  for (const s of sessions) {
    if (s.subject && s.date?.startsWith(calMonth)) {
      subjectMonthMinutes[s.subject.id] = (subjectMonthMinutes[s.subject.id] ?? 0) + s.durationMinutes;
    }
  }

  const thisWeekDays = getThisWeekDays();
  const monthCalDays = buildMonthCalendar(calMonth);

  const totalUSD = holdings.reduce((s, h) => s + toUSD(h), 0);
  const totalCost = holdings.reduce((s, h) => s + costUSD(h), 0);
  const totalProfitPct = totalCost > 0 ? ((totalUSD - totalCost) / totalCost) * 100 : 0;

  const sortedExams = [...exams].sort((a, b) => a.examDate.localeCompare(b.examDate));
  const nearestExam = sortedExams[0];

  // 포트폴리오 일일 수익률 (가중평균)
  const totalDayChangePct = (() => {
    if (holdings.length === 0 || Object.keys(dayChangePct).length === 0) return null;
    let weightedSum = 0, totalW = 0;
    for (const h of holdings) {
      const pct = dayChangePct[h.ticker];
      if (pct !== undefined) {
        const w = toUSD(h);
        weightedSum += pct * w;
        totalW += w;
      }
    }
    return totalW > 0 ? weightedSum / totalW : null;
  })();

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

      {/* Quick stats — 3열 컴팩트 */}
      <div className="grid grid-cols-3 gap-2">
        {/* 학습 현황 (오늘 + 이번 주 합침) */}
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">학습</span>
              {streak > 0 && (
                <span className="text-[10px] text-orange-500 flex items-center gap-0.5 ml-auto shrink-0">
                  <Flame className="w-2.5 h-2.5" />{streak}일
                </span>
              )}
            </div>
            <p className="text-xl font-bold leading-none">
              {todayMinutes}
              <span className="text-xs font-normal text-muted-foreground ml-0.5">분</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              이번 주 {weeklyMinutes >= 60 ? `${Math.floor(weeklyMinutes / 60)}h${weeklyMinutes % 60 > 0 ? ` ${weeklyMinutes % 60}m` : ""}` : `${weeklyMinutes}m`}
              <span className="ml-1">({weeklyGoalPct}%)</span>
            </p>
          </CardContent>
        </Card>
        {/* 시험 D-Day */}
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarClock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">D-Day</span>
            </div>
            {nearestExam ? (
              <>
                <p className={`text-xl font-bold leading-none ${daysUntil(nearestExam.examDate) <= 7 ? "text-red-500" : "text-amber-600"}`}>
                  D-{Math.max(0, daysUntil(nearestExam.examDate))}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">{nearestExam.name}</p>
                {sortedExams[1] && (
                  <p className="text-[10px] text-muted-foreground truncate">외 {sortedExams.length - 1}개</p>
                )}
              </>
            ) : (
              <p className="text-xl font-bold leading-none text-muted-foreground">-</p>
            )}
          </CardContent>
        </Card>
        {/* 포트폴리오 */}
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-500 shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">포트폴리오</span>
            </div>
            <p className={`text-xl font-bold leading-none ${holdings.length > 0 ? getProfitColor(totalProfitPct) : "text-muted-foreground"}`}>
              {holdings.length > 0 ? `${totalProfitPct >= 0 ? "+" : ""}${totalProfitPct.toFixed(1)}%` : "-"}
            </p>
            {totalDayChangePct !== null && (
              <p className={`text-[10px] mt-1 ${getProfitColor(totalDayChangePct)}`}>
                일일 {totalDayChangePct >= 0 ? "+" : ""}{totalDayChangePct.toFixed(2)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 글로벌 시황 */}
      <Card>
        <CardContent className="p-4">
          <MarketOverview compact />
        </CardContent>
      </Card>

      {/* ── 종합 플래너 대시보드 ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-violet-500" />플래너
              {streak > 0 && (
                <Badge variant="secondary" className="gap-1 text-orange-600 bg-orange-100 dark:bg-orange-950">
                  <Flame className="w-3 h-3" />{streak}일 연속
                </Badge>
              )}
            </CardTitle>
            <Link href="/planner" className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              전체 보기<ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {/* 빠른 액션 */}
          <div className="flex gap-1.5 flex-wrap mt-2">
            <Link href="/planner" className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors">
              <CalendarDays className="w-3 h-3" />일정 추가
            </Link>
            <Link href="/study/sessions" className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
              <BookOpen className="w-3 h-3" />공부 기록
            </Link>
            <Link href="/planner?tab=기록" className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
              <NotebookPen className="w-3 h-3" />일기 쓰기
            </Link>
            <Link href="/fortune" className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
              <Sparkles className="w-3 h-3" />운세 확인
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* ── 오늘 ── */}
          <div>
            <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
              <CalendarDays className="w-3.5 h-3.5" />
              오늘 · {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
            </h3>
            <div className="space-y-0 divide-y">
              {/* 오늘 공부 요약 */}
              {todayMinutes > 0 && (
                <div className="flex items-center gap-2.5 py-2 first:pt-0">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {todayMinutes >= 60 ? `${Math.floor(todayMinutes/60)}h${todayMinutes%60>0?` ${todayMinutes%60}m`:""}` : `${todayMinutes}m`}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {todaySessions.filter(s => s.subject).map(s => (
                      <Badge key={s.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {s.subject!.emoji} {s.subject!.name}
                      </Badge>
                    ))}
                  </div>
                  <Link href="/study/sessions" className="text-[10px] text-muted-foreground hover:text-primary ml-auto shrink-0">+ 기록</Link>
                </div>
              )}
              {/* 일정 */}
              <div className="py-2.5 first:pt-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><CalendarDays className="w-3 h-3 text-violet-500" />일정</p>
                  <Link href="/planner" className="text-[10px] text-muted-foreground hover:text-primary">+ 추가</Link>
                </div>
                {todayEvents.length > 0 ? (
                  <div className="space-y-1">
                    {todayEvents.map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.color}`} />
                        <span className="flex-1 truncate">{ev.title}</span>
                        {!ev.isAllDay && ev.startTime && <span className="text-muted-foreground shrink-0">{ev.startTime}</span>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">오늘 일정 없음</p>}
              </div>
              {/* 할 일 */}
              <div className="py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><Check className="w-3 h-3 text-green-500" />할 일</p>
                  {todayGoals.length > 0 && <span className="text-[10px] text-muted-foreground">{todayGoals.filter(g => g.done).length}/{todayGoals.length} 완료</span>}
                </div>
                {todayGoals.length > 0 ? (
                  <>
                    <div className="space-y-1">
                      {todayGoals.slice(0, 3).map(g => (
                        <div key={g.id} className="flex items-center gap-2 text-xs">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${g.done ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                          <span className={`flex-1 truncate ${g.done ? "line-through text-muted-foreground" : ""}`}>{g.title}</span>
                        </div>
                      ))}
                      {todayGoals.length > 3 && <p className="text-[10px] text-muted-foreground">+ {todayGoals.length - 3}개 더</p>}
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(todayGoals.filter(g => g.done).length / todayGoals.length) * 100}%` }} />
                    </div>
                  </>
                ) : <p className="text-xs text-muted-foreground">오늘 할 일 없음</p>}
              </div>
              {/* 일기 */}
              <div className="py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><NotebookPen className="w-3 h-3 text-amber-500" />일기</p>
                  <Link href="/planner?tab=기록" className="text-[10px] text-muted-foreground hover:text-primary">작성하기</Link>
                </div>
                {todayDiary
                  ? <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{todayDiary.content}</p>
                  : <p className="text-xs text-muted-foreground">오늘 일기 미작성</p>}
              </div>
              {/* 운세 */}
              <div className="py-2.5 last:pb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-purple-500" />운세</p>
                  <Link href="/fortune" className="text-[10px] text-muted-foreground hover:text-primary">자세히</Link>
                </div>
                {todayFortune ? (
                  <div className="flex items-start gap-2">
                    {todayFortune.score && (
                      <Badge className="text-xs shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-0">{todayFortune.score}점</Badge>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{todayFortune.overall}</p>
                  </div>
                ) : <p className="text-xs text-muted-foreground">오늘 운세를 확인해보세요</p>}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* ── 이번 주 ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <TrendingUp className="w-3.5 h-3.5" />이번 주
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>총 <span className="font-semibold text-foreground">{Math.floor(weeklyMinutes/60)}h {weeklyMinutes%60}m</span></span>
                <div className="flex items-center gap-1 w-20">
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${weeklyGoalPct}%` }} />
                  </div>
                  <span className="text-[10px] shrink-0">{weeklyGoalPct}%</span>
                </div>
                {editingGoal ? (
                  <div className="flex items-center gap-1">
                    <input ref={goalInputRef} type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                      className="w-12 text-xs border rounded px-1 py-0.5 bg-background text-center"
                      onKeyDown={e => {
                        if (e.key === "Enter") { const v = Math.max(1, Number(goalInput)); setWeeklyGoal(v); localStorage.setItem("weeklyGoalMinutes", String(v)); setEditingGoal(false); }
                        if (e.key === "Escape") setEditingGoal(false);
                      }} />
                    <span className="text-[10px]">분</span>
                    <button onClick={() => { const v = Math.max(1, Number(goalInput)); setWeeklyGoal(v); localStorage.setItem("weeklyGoalMinutes", String(v)); setEditingGoal(false); }}>
                      <Check className="w-3 h-3 text-green-500" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setGoalInput(String(weeklyGoal)); setEditingGoal(true); setTimeout(() => goalInputRef.current?.select(), 50); }}
                    className="flex items-center gap-0.5 hover:text-foreground">
                    목표 {Math.floor(weeklyGoal/60)}h<Pencil className="w-2.5 h-2.5 ml-0.5" />
                  </button>
                )}
              </div>
            </div>
            {/* 7일 바 */}
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {thisWeekDays.map((day) => {
                const mins = sessionDateMap[day] ?? 0;
                const isToday = day === today;
                const evCount = (monthEvents[day] ?? []).length;
                const intensity = mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;
                const bgColors = ["bg-muted/60","bg-green-100 dark:bg-green-900/50","bg-green-300 dark:bg-green-700/60","bg-green-500/70","bg-green-600 dark:bg-green-500"];
                const dow = new Date(day).toLocaleDateString("ko-KR", { weekday: "short" });
                return (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <span className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{dow}</span>
                    <div className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 ${bgColors[intensity]} ${isToday ? "ring-2 ring-primary" : ""}`}>
                      <span className={`text-sm font-bold ${isToday ? "text-primary" : intensity > 2 ? "text-white" : "text-foreground"}`}>
                        {day.slice(8).replace(/^0/, "")}
                      </span>
                      {evCount > 0 && <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />}
                    </div>
                    <span className={`text-[9px] font-medium ${mins > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                      {mins > 0 ? (mins >= 60 ? `${Math.floor(mins/60)}h${mins%60>0?`${mins%60}m`:""}` : `${mins}m`) : "·"}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* 주간 과목별 */}
            {effectiveSubjects.filter(s => (subjectWeekMinutes[s.id] ?? 0) > 0).length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {effectiveSubjects.filter(s => (subjectWeekMinutes[s.id] ?? 0) > 0).map(s => {
                  const wMin = subjectWeekMinutes[s.id] ?? 0;
                  const maxMin = Math.max(...effectiveSubjects.map(x => subjectWeekMinutes[x.id] ?? 0), 1);
                  const pct = Math.round((wMin / maxMin) * 100);
                  return (
                    <div key={s.id} className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">{s.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs truncate text-foreground/80">{s.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{wMin >= 60 ? `${Math.floor(wMin/60)}h${wMin%60>0?`${wMin%60}m`:""}` : `${wMin}m`}</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* ── 월간 캘린더 ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <CalendarDays className="w-3.5 h-3.5" />{calMonth.replace("-", "년 ")}월
              </h3>
              <div className="flex items-center gap-1">
                <button onClick={() => {
                  const [y, m] = calMonth.split("-").map(Number);
                  const d = new Date(y, m - 2, 1);
                  setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                  setSelectedCalDay(null);
                }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">‹</button>
                <button onClick={() => {
                  const now = new Date();
                  setCalMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
                  setSelectedCalDay(null);
                }} className="text-[10px] px-2 py-0.5 rounded border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">오늘</button>
                <button onClick={() => {
                  const [y, m] = calMonth.split("-").map(Number);
                  const d = new Date(y, m, 1);
                  setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                  setSelectedCalDay(null);
                }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">›</button>
              </div>
            </div>

            {/* 캘린더 그리드 */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DOW_KO.map(d => (
                <div key={d} className="text-center text-[10px] text-muted-foreground font-medium pb-1">{d}</div>
              ))}
              {monthCalDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;
                const mins = sessionDateMap[day] ?? 0;
                const isToday = day === today;
                const isSelected = day === selectedCalDay;
                const evs = monthEvents[day] ?? [];
                const hasDiary = !!(todayDiary && day === today);
                const hasFortune = !!(todayFortune?.overall && day === today);
                const intensity = mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;
                const bgColors = ["bg-muted/50 hover:bg-muted","bg-green-100 dark:bg-green-900/40","bg-green-300/70 dark:bg-green-700/50","bg-green-500/60 dark:bg-green-600/60","bg-green-600/80 dark:bg-green-500/80"];
                return (
                  <button key={day}
                    onClick={() => setSelectedCalDay(d => d === day ? null : day)}
                    className={`rounded-lg flex flex-col items-center pt-1.5 pb-1 gap-0.5 transition-all hover:scale-105 min-h-[3.2rem]
                      ${bgColors[intensity]}
                      ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                      ${isSelected ? "ring-2 ring-blue-400 ring-offset-1 scale-105" : ""}
                    `}
                  >
                    <span className={`text-[11px] font-bold leading-none ${isToday ? "text-primary" : intensity > 2 ? "text-white" : "text-foreground"}`}>
                      {day.slice(8).replace(/^0/, "")}
                    </span>
                    <div className="flex gap-0.5 flex-wrap justify-center min-h-[6px]">
                      {evs.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                      {hasDiary && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      {hasFortune && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400/70 inline-block" />공부</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />일정</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />일기</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />운세</span>
            </div>

            {/* 날짜 클릭 상세 패널 */}
            {selectedCalDay && (
              <div className="mt-3 rounded-xl border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">
                    {new Date(selectedCalDay + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                  </p>
                  <button onClick={() => setSelectedCalDay(null)} className="text-muted-foreground hover:text-foreground text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-muted">✕</button>
                </div>
                {(sessionDateMap[selectedCalDay] ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <BookOpen className="w-3 h-3 text-green-500 shrink-0" />
                    <span>공부 {(() => { const m = sessionDateMap[selectedCalDay]; return m >= 60 ? `${Math.floor(m/60)}h${m%60>0?` ${m%60}m`:""}` : `${m}m`; })()}</span>
                  </div>
                )}
                {(monthEvents[selectedCalDay] ?? []).length > 0 && (
                  <div className="space-y-0.5">
                    {(monthEvents[selectedCalDay]).map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 text-xs">
                        <CalendarDays className="w-3 h-3 text-violet-500 shrink-0" />
                        <span className="flex-1 truncate">{ev.title}</span>
                        {!ev.isAllDay && ev.startTime && <span className="text-muted-foreground shrink-0">{ev.startTime}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {todayDiary && selectedCalDay === today && (
                  <div className="flex items-start gap-2 text-xs">
                    <NotebookPen className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-muted-foreground line-clamp-2 leading-relaxed">{todayDiary.content}</p>
                  </div>
                )}
                {todayFortune?.overall && selectedCalDay === today && (
                  <div className="flex items-start gap-2 text-xs">
                    <Sparkles className="w-3 h-3 text-purple-500 shrink-0 mt-0.5" />
                    <p className="text-muted-foreground line-clamp-1">{todayFortune.overall}</p>
                  </div>
                )}
                {(sessionDateMap[selectedCalDay] ?? 0) === 0 && (monthEvents[selectedCalDay] ?? []).length === 0 && !(todayDiary && selectedCalDay === today) && !(todayFortune?.overall && selectedCalDay === today) && (
                  <p className="text-xs text-muted-foreground">이날 기록 없음</p>
                )}
                <div className="flex gap-1.5 pt-0.5 flex-wrap">
                  <Link href="/planner" className="text-[10px] px-2 py-1 rounded border bg-background hover:bg-accent transition-colors">+ 일정</Link>
                  <Link href="/study/sessions" className="text-[10px] px-2 py-1 rounded border bg-background hover:bg-accent transition-colors">+ 공부 기록</Link>
                  <Link href="/planner?tab=기록" className="text-[10px] px-2 py-1 rounded border bg-background hover:bg-accent transition-colors">✏️ 일기</Link>
                </div>
              </div>
            )}

            {/* 월간 과목별 학습 */}
            {effectiveSubjects.filter(s => (subjectMonthMinutes[s.id] ?? 0) > 0).length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">이달 과목별 학습</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {effectiveSubjects.filter(s => (subjectMonthMinutes[s.id] ?? 0) > 0).map(s => {
                    const wMin = subjectMonthMinutes[s.id] ?? 0;
                    const maxMin = Math.max(...effectiveSubjects.map(x => subjectMonthMinutes[x.id] ?? 0), 1);
                    const pct = Math.round((wMin / maxMin) * 100);
                    return (
                      <div key={s.id} className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{s.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs truncate text-foreground/80">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{wMin >= 60 ? `${Math.floor(wMin/60)}h${wMin%60>0?`${wMin%60}m`:""}` : `${wMin}m`}</span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* 포트폴리오 */}
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
          <CardContent>
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
                    {totalDayChangePct !== null && (
                      <p className={`text-[11px] mt-0.5 ${getProfitColor(totalDayChangePct)}`}>
                        일일 {totalDayChangePct >= 0 ? "+" : ""}{totalDayChangePct.toFixed(2)}%
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {holdings.slice(0, 6).map(h => {
                    const rate = h.avgPrice > 0 ? ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100 : 0;
                    const dayPct = dayChangePct[h.ticker];
                    return (
                      <Link key={h.id} href={`/stock/${encodeURIComponent(h.ticker)}`} className="block">
                        <div className="rounded-lg border p-2.5 hover:bg-accent transition-colors">
                          <p className="text-[11px] font-bold font-mono text-foreground">{h.ticker}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{h.name}</p>
                          <p className={`text-sm font-bold mt-1 ${getProfitColor(rate)}`}>
                            {rate >= 0 ? "+" : ""}{rate.toFixed(1)}%
                          </p>
                          {dayPct !== undefined && (
                            <p className={`text-[10px] ${getProfitColor(dayPct)}`}>
                              일일 {dayPct >= 0 ? "+" : ""}{dayPct.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {holdings.length > 6 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">외 {holdings.length - 6}개 종목</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

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
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: "/study/subjects", icon: "📚", label: "학습 관리" },
            { href: "/stock", icon: "📡", label: "증권 동향" },
            { href: "/community?category=free", icon: "🗣️", label: "자유게시판" },
            { href: "/restaurant", icon: "🍜", label: "맛집" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-3 text-center">
                  <span className="text-xl">{item.icon}</span>
                  <p className="font-medium text-xs mt-1.5 leading-tight">{item.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
