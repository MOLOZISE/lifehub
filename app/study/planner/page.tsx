"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Wand2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayString, COLOR_MAP } from "@/lib/utils-app";
import type { Subject } from "@/lib/types";
import { toast } from "sonner";

interface PlanDay {
  date: string;
  dayLabel: string;
  tasks: { subject: string; emoji: string; activity: string; minutes: number }[];
}

export default function PlannerPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState("3");
  const [plan, setPlan] = useState<PlanDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [memo, setMemo] = useState("");

  useEffect(() => {
    fetch("/api/study/subjects")
      .then(r => r.ok ? r.json() : [])
      .then(data => setSubjects(Array.isArray(data) ? data : (data.subjects ?? [])));
  }, []);

  async function generatePlan() {
    if (!examDate) { toast.error("시험일을 입력해주세요"); return; }
    if (subjects.length === 0) { toast.error("과목을 먼저 추가해주세요"); return; }

    setLoading(true);
    try {
      const today = todayString();
      const daysLeft = Math.ceil((new Date(examDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 0) { toast.error("시험일이 오늘 이후여야 합니다"); return; }

      const subjectList = subjects.map(s => `- ${s.emoji} ${s.name}${s.examDate ? ` (시험일: ${s.examDate})` : ""}`).join("\n");

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: `당신은 학습 플래너 전문가입니다. 학생의 시험 일정과 과목을 분석하여 효율적인 학습 계획을 세워줍니다.
반드시 아래 JSON 형식으로만 응답하세요:
{
  "memo": "전체적인 학습 전략 한두 문장",
  "plan": [
    {
      "date": "YYYY-MM-DD",
      "dayLabel": "D-N",
      "tasks": [
        {"subject": "과목명", "emoji": "이모지", "activity": "활동 설명", "minutes": 60}
      ]
    }
  ]
}
오늘부터 시험 전날까지 최대 14일치 계획을 세워주세요. 주말 포함, 하루 학습량은 ${dailyHours}시간 기준.`,
          userMessage: `오늘: ${today}\n시험일: ${examDate} (D-${daysLeft})\n하루 학습 시간: ${dailyHours}시간\n\n과목 목록:\n${subjectList}\n\n최적의 학습 계획을 세워주세요.`,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const jsonMatch = data.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("응답 파싱 실패");
      const parsed = JSON.parse(jsonMatch[0]);
      setPlan(parsed.plan ?? []);
      setMemo(parsed.memo ?? "");
      toast.success("학습 계획이 생성되었습니다!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  }

  const today = todayString();
  const daysLeft = examDate ? Math.ceil((new Date(examDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />AI 학습 플래너
        </h2>
        <p className="text-sm text-muted-foreground mt-1">시험일을 입력하면 AI가 최적의 학습 계획을 세워드립니다</p>
      </div>

      {/* Input card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium mb-1.5">시험일</p>
              <Input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                min={todayString()}
              />
              {daysLeft !== null && daysLeft > 0 && (
                <p className="text-xs text-muted-foreground mt-1">D-{daysLeft}일 남음</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5">하루 학습 시간</p>
              <Select value={dailyHours} onValueChange={v => v && setDailyHours(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1","2","3","4","5","6","8"].map(h => (
                    <SelectItem key={h} value={h}>{h}시간</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5">과목 ({subjects.length}개)</p>
              <div className="flex flex-wrap gap-1">
                {subjects.length === 0
                  ? <span className="text-xs text-muted-foreground">과목 없음</span>
                  : subjects.slice(0, 4).map(s => (
                    <Badge key={s.id} variant="outline" className="text-xs">{s.emoji} {s.name}</Badge>
                  ))}
                {subjects.length > 4 && <Badge variant="outline" className="text-xs">+{subjects.length - 4}</Badge>}
              </div>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={generatePlan}
            disabled={loading || !examDate || subjects.length === 0}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />계획 생성 중...</>
              : <><Wand2 className="w-4 h-4 mr-2" />AI 학습 계획 생성</>}
          </Button>
        </CardContent>
      </Card>

      {/* Plan result */}
      {memo && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium">📋 학습 전략</p>
            <p className="text-sm text-muted-foreground mt-1">{memo}</p>
          </CardContent>
        </Card>
      )}

      {plan.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{plan.length}일 학습 계획</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={generatePlan} disabled={loading}>
              <RefreshCw className="w-3 h-3" />재생성
            </Button>
          </div>
          {plan.map((day, i) => {
            const isPast = day.date < today;
            const isToday = day.date === today;
            const totalMin = day.tasks.reduce((s, t) => s + t.minutes, 0);
            return (
              <Card key={i} className={`${isPast ? "opacity-50" : ""} ${isToday ? "ring-2 ring-primary" : ""}`}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={isToday ? "default" : "outline"} className="text-xs">{day.dayLabel}</Badge>
                      <span className="text-sm font-medium">
                        {new Date(day.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}
                      </span>
                      {isToday && <Badge className="text-xs bg-green-500">오늘</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">{totalMin}분</span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1.5">
                    {day.tasks.map((task, j) => {
                      const subj = subjects.find(s => s.name === task.subject);
                      const colors = subj ? COLOR_MAP[subj.color as import("@/lib/types").SubjectColor] : null;
                      return (
                        <div key={j} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${colors ? `${colors.light} ${colors.text}` : "bg-muted"}`}>
                          <span>{task.emoji}</span>
                          <span className="font-medium">{task.subject}</span>
                          <span className="flex-1 text-xs opacity-80">{task.activity}</span>
                          <span className="text-xs font-medium shrink-0">{task.minutes}분</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
