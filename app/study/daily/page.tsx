"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PomodoroTimer } from "@/components/study/PomodoroTimer";
import { todayString } from "@/lib/utils-app";
import { toast } from "sonner";

interface Subject { id: string; name: string; emoji: string | null; }
interface DailyGoalItem { id: string; subjectId: string; targetMinutes: number; done: boolean; }
interface DailyGoal { id: string; date: string; goals: DailyGoalItem[]; }
interface StudyLog { id: string; subjectId: string; activityType: string; durationMinutes: number; createdAt: string; date: string; }

export default function DailyPage() {
  const today = todayString();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [sessions, setSessions] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [goalSubject, setGoalSubject] = useState("");
  const [goalMinutes, setGoalMinutes] = useState("60");

  const loadAll = useCallback(async () => {
    const [subRes, dailyRes] = await Promise.all([
      fetch("/api/study/subjects"),
      fetch(`/api/study/daily?date=${today}`),
    ]);
    if (subRes.ok) setSubjects(await subRes.json());
    if (dailyRes.ok) {
      const data = await dailyRes.json();
      setGoal(data.goal);
      setLogs(data.logs ?? []);
    }
  }, [today]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handlePomodoroComplete(durationMinutes: number) {
    setSessions((s) => s + 1);
    if (!selectedSubject) return;
    const res = await fetch("/api/study/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, subjectId: selectedSubject, activityType: "pomodoro", durationMinutes }),
    });
    if (res.ok) {
      const newLog = await res.json();
      setLogs((prev) => [...prev, newLog]);
    }
  }

  async function addGoal() {
    if (!goalSubject) return;
    const currentGoals = goal?.goals ?? [];
    const updated = [
      ...currentGoals.filter(g => g.subjectId !== goalSubject),
      { subjectId: goalSubject, targetMinutes: Number(goalMinutes), done: false },
    ];
    const res = await fetch("/api/study/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, goals: updated }),
    });
    if (res.ok) {
      const data = await res.json();
      setGoal(data);
      setGoalSubject("");
    } else {
      toast.error("저장 실패");
    }
  }

  async function toggleGoalDone(subjectId: string) {
    if (!goal) return;
    const updated = goal.goals.map(g =>
      g.subjectId === subjectId ? { ...g, done: !g.done } : g
    );
    const res = await fetch("/api/study/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, goals: updated }),
    });
    if (res.ok) {
      const data = await res.json();
      setGoal(data);
    }
  }

  const totalStudyMin = logs.reduce((sum, l) => sum + l.durationMinutes, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pomodoro */}
        <div className="space-y-3">
          <Select value={selectedSubject} onValueChange={(v) => v && setSelectedSubject(v)}>
            <SelectTrigger><SelectValue placeholder="과목 선택 (선택사항)" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <PomodoroTimer onSessionComplete={handlePomodoroComplete} />
        </div>

        {/* Today summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">📊 오늘의 학습 요약</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted">
                <p className="text-xl font-bold">{totalStudyMin}</p>
                <p className="text-xs text-muted-foreground">분</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <p className="text-xl font-bold">{sessions}</p>
                <p className="text-xs text-muted-foreground">뽀모도로</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <p className="text-xl font-bold">{logs.length}</p>
                <p className="text-xs text-muted-foreground">활동</p>
              </div>
            </div>
            {/* Goals */}
            <div className="space-y-2">
              {(goal?.goals ?? []).map(g => {
                const subj = subjects.find(s => s.id === g.subjectId);
                const done = logs.filter(l => l.subjectId === g.subjectId).reduce((s, l) => s + l.durationMinutes, 0);
                return (
                  <div key={g.subjectId} className="flex items-center gap-2">
                    <button onClick={() => toggleGoalDone(g.subjectId)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${g.done ? "bg-green-500 border-green-500" : "border-muted-foreground"}`}>
                      {g.done && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="truncate">{subj?.emoji} {subj?.name}</span>
                        <span className="text-muted-foreground">{Math.min(done, g.targetMinutes)}/{g.targetMinutes}분</span>
                      </div>
                      <Progress value={Math.min(100, (done / g.targetMinutes) * 100)} className="h-1" />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Add goal */}
            <div className="flex gap-2">
              <Select value={goalSubject} onValueChange={v => v && setGoalSubject(v)}>
                <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="과목" /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" value={goalMinutes} onChange={e => setGoalMinutes(e.target.value)} className="w-20 h-8 text-xs" placeholder="분" />
              <Button size="sm" className="h-8" onClick={addGoal}><Plus className="w-3.5 h-3.5" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Log timeline */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">📋 오늘의 학습 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.slice().reverse().map(log => {
                const subj = subjects.find(s => s.id === log.subjectId);
                const time = new Date(log.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
                const typeLabel = ({ note: "노트", quiz: "퀴즈", flashcard: "플래시카드", pomodoro: "뽀모도로", session: "세션" } as Record<string, string>)[log.activityType] ?? log.activityType;
                return (
                  <div key={log.id} className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">{time}</span>
                    <span className="text-base">{subj?.emoji ?? "📚"}</span>
                    <span>{subj?.name ?? "알 수 없음"}</span>
                    <span className="text-xs text-muted-foreground">{typeLabel}</span>
                    <span className="text-muted-foreground text-xs ml-auto">{log.durationMinutes}분</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
