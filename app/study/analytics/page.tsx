"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Clock, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const today = todayString();

  const [aiAdvice, setAiAdvice] = useState<{
    sections: { title: string; content: string }[];
    generatedAt: string;
    totalMinutes: number;
    avgFocus: number;
    sessionCount: number;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function loadAiAdvice(force = false) {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/study/ai-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.error) {
        setAiError(data.error);
        return;
      }
      setAiAdvice(data);
    } catch {
      setAiError("AI 분석 실패");
    } finally {
      setAiLoading(false);
    }
  }

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

  if (loading) return <div className="p-8 text-center text-muted-foreground">분석 중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">학습 분석</h1>
        <p className="text-sm text-muted-foreground mt-0.5">데이터 기반 패턴 분석</p>
      </div>

      {/* Heatmap */}
      <Card className="overflow-visible">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📅 학습 잔디</CardTitle>
        </CardHeader>
        <CardContent>
          <StudyHeatmap data={heatmapData} weeks={17} />
        </CardContent>
      </Card>

      {/* Key numbers */}
      <div className="grid grid-cols-4 gap-3">
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

      {/* AI 학습 조언 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
              🤖 AI 학습 조언
              <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-md font-medium">Groq AI</span>
              <span className="text-[10px] text-muted-foreground font-normal">최근 30일 기준</span>
              {aiAdvice && (
                <span className="text-[10px] text-muted-foreground font-normal">
                  · {new Date(aiAdvice.generatedAt).toLocaleString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })} 생성
                </span>
              )}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadAiAdvice(true)}
              disabled={aiLoading}
              className="h-7 text-xs"
            >
              {aiLoading ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                "🔄 "
              )}
              {aiAdvice ? "재분석" : "AI 분석 시작"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">학습 패턴 분석 중... (10~20초)</span>
            </div>
          )}
          {aiError && (
            <p className="text-sm text-destructive p-3 bg-destructive/10 rounded-lg">
              {aiError}
            </p>
          )}
          {!aiLoading && !aiAdvice && !aiError && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm">
                버튼을 클릭하면 30일 학습 데이터를 기반으로 AI 맞춤 조언을 제공합니다
              </p>
            </div>
          )}
          {aiAdvice && !aiLoading && (
            <div className="space-y-4">
              {aiAdvice.sections.map((sec, i) => (
                <div key={i} className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs font-semibold mb-1.5">{sec.title}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {sec.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
