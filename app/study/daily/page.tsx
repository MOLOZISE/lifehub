"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Pause, RotateCcw, Plus, Check, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSubjects, getStudyLogs, saveStudyLog, getDailyGoal, saveDailyGoal } from "@/lib/storage";
import { generateId, todayString } from "@/lib/utils-app";
import type { Subject, StudyLog, DailyGoal } from "@/lib/types";

const FOCUS_MIN = 25;
const BREAK_MIN = 5;

export default function DailyPage() {
  const today = todayString();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [goal, setGoal] = useState<DailyGoal>({ date: today, goals: [] });
  // Pomodoro
  const [pomPhase, setPomPhase] = useState<"focus" | "break">("focus");
  const [pomMinutes, setPomMinutes] = useState(FOCUS_MIN);
  const [pomSeconds, setPomSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  // Add goal form
  const [goalSubject, setGoalSubject] = useState("");
  const [goalMinutes, setGoalMinutes] = useState("60");

  useEffect(() => {
    setSubjects(getSubjects());
    setLogs(getStudyLogs(today));
    const g = getDailyGoal(today);
    if (g) setGoal(g);
  }, []);

  useEffect(() => {
    if (running) {
      startTimeRef.current = new Date();
      timerRef.current = setInterval(() => {
        setPomSeconds(prev => {
          if (prev > 0) return prev - 1;
          setPomMinutes(m => {
            if (m > 0) { return m - 1; }
            // Timer done
            clearInterval(timerRef.current!);
            setRunning(false);
            handleTimerEnd();
            return pomPhase === "focus" ? FOCUS_MIN : BREAK_MIN;
          });
          return 59;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  function handleTimerEnd() {
    if (pomPhase === "focus") {
      setSessions(s => s + 1);
      if (selectedSubject) {
        const log: StudyLog = {
          id: generateId(), date: today, subjectId: selectedSubject,
          activityType: "pomodoro", durationMinutes: FOCUS_MIN,
          createdAt: new Date().toISOString(),
        };
        saveStudyLog(log);
        setLogs(prev => [...prev, log]);
      }
      if (notifEnabled && "Notification" in window) {
        new Notification("집중 완료! 🍅", { body: "5분 휴식 시간입니다." });
      }
      setPomPhase("break");
      setPomMinutes(BREAK_MIN);
      setPomSeconds(0);
    } else {
      if (notifEnabled && "Notification" in window) {
        new Notification("휴식 끝! ⏰", { body: "다시 집중할 시간입니다." });
      }
      setPomPhase("focus");
      setPomMinutes(FOCUS_MIN);
      setPomSeconds(0);
    }
  }

  function resetTimer() {
    setRunning(false);
    setPomPhase("focus");
    setPomMinutes(FOCUS_MIN);
    setPomSeconds(0);
  }

  async function requestNotif() {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotifEnabled(perm === "granted");
    }
  }

  function addGoal() {
    if (!goalSubject) return;
    const updated: DailyGoal = {
      ...goal,
      goals: [...goal.goals.filter(g => g.subjectId !== goalSubject), {
        subjectId: goalSubject, targetMinutes: Number(goalMinutes), done: false,
      }],
    };
    setGoal(updated);
    saveDailyGoal(updated);
    setGoalSubject("");
  }

  function toggleGoalDone(subjectId: string) {
    const updated: DailyGoal = {
      ...goal,
      goals: goal.goals.map(g => g.subjectId === subjectId ? { ...g, done: !g.done } : g),
    };
    setGoal(updated);
    saveDailyGoal(updated);
  }

  const totalStudyMin = logs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const progressPct = ((((pomPhase === "focus" ? FOCUS_MIN : BREAK_MIN) * 60) - (pomMinutes * 60 + pomSeconds)) / ((pomPhase === "focus" ? FOCUS_MIN : BREAK_MIN) * 60)) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pomodoro */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              🍅 뽀모도로 타이머
              <Badge variant={pomPhase === "focus" ? "default" : "secondary"}>
                {pomPhase === "focus" ? "집중" : "휴식"}
              </Badge>
              <span className="ml-auto text-sm font-normal text-muted-foreground">{sessions}세션</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedSubject} onValueChange={v => v && setSelectedSubject(v)}>
              <SelectTrigger><SelectValue placeholder="과목 선택 (선택사항)" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-center">
              <p className="text-6xl font-mono font-bold tracking-tight">
                {pad(pomMinutes)}:{pad(pomSeconds)}
              </p>
              <Progress value={progressPct} className="mt-3 h-2" />
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="icon" onClick={resetTimer}><RotateCcw className="w-4 h-4" /></Button>
              <Button className="px-8" onClick={() => setRunning(!running)}>
                {running ? <><Pause className="w-4 h-4 mr-2" />일시정지</> : <><Play className="w-4 h-4 mr-2" />시작</>}
              </Button>
              <Button variant="outline" size="icon" onClick={notifEnabled ? () => setNotifEnabled(false) : requestNotif}>
                {notifEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

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
              {goal.goals.map(g => {
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
                    <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
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
