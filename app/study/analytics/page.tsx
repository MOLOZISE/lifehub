"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp, Clock, Target, Zap, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getSubjects, getExams, getStudySessions, getStudyLogs,
  getWrongAnswerNotes, getSubjectStudyMinutes,
} from "@/lib/storage";
import { generateStudyRecommendations } from "@/lib/recommendation";
import { todayString, COLOR_MAP } from "@/lib/utils-app";
import type { Subject, StudyRecommendation } from "@/lib/types";

const PRIORITY_COLORS = {
  high: "border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-800",
  medium: "border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800",
  low: "border-green-400 bg-green-50 dark:bg-green-950/30 dark:border-green-800",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-green-500 text-white",
};

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default function AnalyticsPage() {
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectMinutes, setSubjectMinutes] = useState<Record<string, number>>({});
  const [weeklyData, setWeeklyData] = useState<{ day: string; minutes: number }[]>([]);
  const [sessionMetrics, setSessionMetrics] = useState({ avgFocus: 0, avgFatigue: 0, avgSatisfaction: 0 });
  const [wrongAnswerStats, setWrongAnswerStats] = useState({ total: 0, due: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subs = getSubjects();
    setSubjects(subs);

    // Recommendations
    setRecommendations(generateStudyRecommendations());

    // Subject minutes (last 30 days)
    const mins = getSubjectStudyMinutes(30);
    setSubjectMinutes(mins);

    // Weekly chart
    const last7 = getLast7Days();
    const sessions = getStudySessions();
    const logs = getStudyLogs();
    const weekly = last7.map(date => {
      const sessionMin = sessions.filter(s => s.date === date).reduce((sum, s) => sum + s.durationMinutes, 0);
      const logMin = logs.filter(l => l.date === date && l.activityType !== "session").reduce((sum, l) => sum + l.durationMinutes, 0);
      return {
        day: new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
        minutes: sessionMin + logMin,
      };
    });
    setWeeklyData(weekly);

    // Session metrics (last 14 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const recentSessions = sessions.filter(s => s.date >= cutoff.toISOString().slice(0, 10));
    if (recentSessions.length > 0) {
      setSessionMetrics({
        avgFocus: recentSessions.reduce((s, x) => s + x.focusScore, 0) / recentSessions.length,
        avgFatigue: recentSessions.reduce((s, x) => s + x.fatigueScore, 0) / recentSessions.length,
        avgSatisfaction: recentSessions.reduce((s, x) => s + x.satisfactionScore, 0) / recentSessions.length,
      });
    }

    // Wrong answer stats
    const wrongs = getWrongAnswerNotes();
    const today = todayString();
    setWrongAnswerStats({
      total: wrongs.filter(w => !w.resolved).length,
      due: wrongs.filter(w => !w.resolved && w.nextReviewAt <= today).length,
      resolved: wrongs.filter(w => w.resolved).length,
    });

    setLoading(false);
  }, []);

  // Subject bar chart data
  const subjectChartData = subjects
    .map(s => ({
      name: s.name,
      emoji: s.emoji,
      minutes: subjectMinutes[s.id] ?? 0,
    }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 8);

  // Radar chart data for session metrics
  const radarData = [
    { metric: "집중도", value: Math.round(sessionMetrics.avgFocus * 20) },
    { metric: "만족도", value: Math.round(sessionMetrics.avgSatisfaction * 20) },
    { metric: "활력", value: Math.round((5 - sessionMetrics.avgFatigue + 1) * 20) },
  ];

  const totalMin30 = Object.values(subjectMinutes).reduce((a, b) => a + b, 0);

  if (loading) return <div className="p-8 text-center text-muted-foreground">분석 중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">학습 분석</h1>
        <p className="text-sm text-muted-foreground mt-0.5">데이터 기반 추천 행동과 패턴 분석</p>
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          오늘의 추천 행동
        </h2>
        {recommendations.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm text-muted-foreground">모든 학습 지표가 양호합니다!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recommendations.map(rec => (
              <div key={rec.id} className={`border-l-4 rounded-lg p-4 ${PRIORITY_COLORS[rec.priority]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[rec.priority]}`}>
                        {rec.priority === "high" ? "긴급" : rec.priority === "medium" ? "권장" : "참고"}
                      </span>
                      <span className="font-medium text-sm">{rec.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                  {rec.actionHref && (
                    <Link href={rec.actionHref}>
                      <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs">
                        {rec.actionLabel ?? "이동"} <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <p className="text-xs text-muted-foreground">최근 30일</p>
            </div>
            <p className="text-xl font-bold">{Math.round(totalMin30 / 60)}<span className="text-sm font-normal ml-1">시간</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-xs text-muted-foreground">평균 집중도</p>
            </div>
            <p className="text-xl font-bold">
              {sessionMetrics.avgFocus > 0 ? sessionMetrics.avgFocus.toFixed(1) : "-"}
              <span className="text-sm font-normal ml-1">/ 5</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <p className="text-xs text-muted-foreground">오답 복습 예정</p>
            </div>
            <p className={`text-xl font-bold ${wrongAnswerStats.due > 0 ? "text-red-500" : ""}`}>{wrongAnswerStats.due}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              <p className="text-xs text-muted-foreground">오답 해결률</p>
            </div>
            <p className="text-xl font-bold">
              {wrongAnswerStats.total + wrongAnswerStats.resolved > 0
                ? Math.round(wrongAnswerStats.resolved / (wrongAnswerStats.total + wrongAnswerStats.resolved) * 100)
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">최근 7일 학습 시간</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v}분`, "학습"]} />
                <Bar dataKey="minutes" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Session quality radar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">최근 2주 세션 품질</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionMetrics.avgFocus === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                세션 기록이 없습니다
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <Radar dataKey="value" fill="#6366f1" fillOpacity={0.4} stroke="#6366f1" />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subject breakdown */}
      {subjectChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">과목별 학습 시간 (최근 30일)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subjectChartData.map(item => {
                const pct = totalMin30 > 0 ? (item.minutes / totalMin30) * 100 : 0;
                const subject = subjects.find(s => s.name === item.name);
                const colors = subject ? COLOR_MAP[subject.color] : null;
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-sm w-5">{item.emoji}</span>
                    <span className="text-sm w-28 truncate">{item.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${colors?.bg ?? "bg-indigo-500"}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {item.minutes >= 60
                        ? `${Math.floor(item.minutes / 60)}h${item.minutes % 60 > 0 ? ` ${item.minutes % 60}m` : ""}`
                        : `${item.minutes}m`}
                    </span>
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/study/exams", label: "시험 관리", icon: "🎯" },
          { href: "/study/sessions", label: "세션 기록", icon: "📝" },
          { href: "/study/wrong-answers", label: "오답 노트", icon: "❌" },
          { href: "/study/subjects", label: "과목 관리", icon: "📚" },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-3 flex items-center gap-2">
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
