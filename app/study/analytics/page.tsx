"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Clock, Zap, Sparkles, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StudyHeatmap } from "@/components/study/StudyHeatmap";
import { todayString, localDateStr, COLOR_MAP } from "@/lib/utils-app";

interface Subject { id: string; name: string; emoji: string; color: string; }
interface StudySession {
  id: string; date: string; subjectId: string; durationMinutes: number;
  focusScore: number; fatigueScore: number; satisfactionScore: number;
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return localDateStr(d);
  });
}

export default function AnalyticsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiRecs, setAiRecs] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const today = todayString();

  useEffect(() => {
    async function loadAll() {
      const [subRes, sessRes] = await Promise.all([
        fetch("/api/study/subjects"),
        fetch("/api/study/sessions?limit=500"),
      ]);
      if (subRes.ok) setSubjects(await subRes.json());
      if (sessRes.ok) {
        const d = await sessRes.json();
        setSessions(d.sessions ?? d);
      }
      setLoading(false);
    }
    loadAll();
  }, []);

  // Heatmap data
  const heatmapData = Object.entries(
    sessions.reduce((acc, s) => {
      acc[s.date] = (acc[s.date] ?? 0) + s.durationMinutes;
      return acc;
    }, {} as Record<string, number>)
  ).map(([date, minutes]) => ({ date, minutes }));

  // Weekly chart
  const last7 = getLast7Days();
  const weeklyData = last7.map(date => ({
    day: new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
    minutes: sessions.filter(s => s.date === date).reduce((sum, s) => sum + s.durationMinutes, 0),
  }));

  // Subject minutes (last 30 days)
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = localDateStr(cutoff30);
  const subjectMinutes = sessions
    .filter(s => s.date >= cutoff30Str)
    .reduce((acc, s) => {
      acc[s.subjectId] = (acc[s.subjectId] ?? 0) + s.durationMinutes;
      return acc;
    }, {} as Record<string, number>);
  const totalMin30 = Object.values(subjectMinutes).reduce((a, b) => a + b, 0);

  const subjectChartData = subjects
    .map(s => ({ name: s.name, emoji: s.emoji, color: s.color, id: s.id, minutes: subjectMinutes[s.id] ?? 0 }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 8);

  // Session metrics (last 14 days)
  const cutoff14 = new Date();
  cutoff14.setDate(cutoff14.getDate() - 14);
  const cutoff14Str = localDateStr(cutoff14);
  const recentSessions = sessions.filter(s => s.date >= cutoff14Str);
  const avgFocus = recentSessions.length > 0
    ? recentSessions.reduce((s, x) => s + x.focusScore, 0) / recentSessions.length : 0;
  const avgFatigue = recentSessions.length > 0
    ? recentSessions.reduce((s, x) => s + x.fatigueScore, 0) / recentSessions.length : 0;
  const avgSatisfaction = recentSessions.length > 0
    ? recentSessions.reduce((s, x) => s + x.satisfactionScore, 0) / recentSessions.length : 0;

  const radarData = [
    { metric: "집중도", value: Math.round(avgFocus * 20) },
    { metric: "만족도", value: Math.round(avgSatisfaction * 20) },
    { metric: "활력", value: Math.round((5 - avgFatigue + 1) * 20) },
  ];

  // Today's study minutes
  const todayMinutes = sessions.filter(s => s.date === today).reduce((sum, s) => sum + s.durationMinutes, 0);
  // Weekly streak
  const streak = (() => {
    const dateSet = new Set(sessions.map(s => s.date?.slice(0, 10)));
    let count = 0;
    const now = new Date();
    while (true) {
      const d = new Date(now);
      d.setDate(d.getDate() - count);
      if (dateSet.has(localDateStr(d))) count++;
      else break;
    }
    return count;
  })();

  async function generateRecommendations() {
    setAiLoading(true);
    setAiRecs("");
    try {
      const subjectSummary = subjects.map(s => {
        const mins = subjectMinutes[s.id] ?? 0;
        return `- ${s.emoji} ${s.name}: 최근30일 ${mins}분 학습`;
      }).join("\n");

      const prompt = `학습 현황:
총 학습 (최근 30일): ${Math.round(totalMin30 / 60)}시간 ${totalMin30 % 60}분
평균 집중도: ${avgFocus > 0 ? avgFocus.toFixed(1) : "기록 없음"}/5
평균 만족도: ${avgSatisfaction > 0 ? avgSatisfaction.toFixed(1) : "기록 없음"}/5
연속 학습일: ${streak}일

과목별 현황:
${subjectSummary || "과목 없음"}

최근 7일 학습 패턴:
${weeklyData.map(d => `${d.day}: ${d.minutes}분`).join(", ")}`;

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: `당신은 전문 학습 코치입니다. 학생의 학습 데이터를 분석하여 구체적이고 실용적인 개선 방안을 제시하세요.
분석은 다음 형식으로 작성하세요:
1. 현재 학습 패턴 분석 (2-3줄)
2. 우선 개선 사항 3가지 (각 항목 구체적 행동 제안)
3. 이번 주 집중 목표 1가지
간결하고 실천 가능한 조언을 제공하세요.`,
          userMessage: prompt,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiRecs(data.text);
    } catch { setAiRecs("추천 생성에 실패했습니다. 다시 시도해주세요."); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">분석 중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">학습 분석</h1>
        <p className="text-sm text-muted-foreground mt-0.5">데이터 기반 패턴 분석</p>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📅 학습 잔디</CardTitle>
        </CardHeader>
        <CardContent>
          <StudyHeatmap data={heatmapData} weeks={17} />
        </CardContent>
      </Card>

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
              {avgFocus > 0 ? avgFocus.toFixed(1) : "-"}
              <span className="text-sm font-normal ml-1">/ 5</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              <p className="text-xs text-muted-foreground">오늘 학습</p>
            </div>
            <p className="text-xl font-bold">{todayMinutes}<span className="text-sm font-normal ml-1">분</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-orange-500" />
              <p className="text-xs text-muted-foreground">연속 학습</p>
            </div>
            <p className={`text-xl font-bold ${streak >= 3 ? "text-orange-500" : ""}`}>
              {streak}<span className="text-sm font-normal ml-1">일</span>
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
            {avgFocus === 0 ? (
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
                const colors = COLOR_MAP[item.color as import("@/lib/types").SubjectColor];
                return (
                  <div key={item.id} className="flex items-center gap-3">
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

      {/* AI Recommendations */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" />AI 학습 추천
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={generateRecommendations} disabled={aiLoading || sessions.length === 0}>
              {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {aiRecs ? "재분석" : "분석 생성"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiLoading ? (
            <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />학습 데이터 분석 중...
            </div>
          ) : aiRecs ? (
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{aiRecs}</p>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {sessions.length === 0
                ? "학습 세션을 기록하면 AI 추천을 받을 수 있습니다."
                : "학습 데이터를 분석하여 맞춤 추천을 받아보세요."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/study/exams", label: "시험 관리", icon: "🎯" },
          { href: "/study/sessions", label: "세션 기록", icon: "📝" },
          { href: "/study/planner", label: "AI 플래너", icon: "🤖" },
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
