"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "focus" | "short_break" | "long_break";

const MODE_CONFIG: Record<Mode, { label: string; minutes: number; color: string }> = {
  focus:       { label: "집중", minutes: 25, color: "text-red-500" },
  short_break: { label: "짧은 휴식", minutes: 5,  color: "text-green-500" },
  long_break:  { label: "긴 휴식", minutes: 15, color: "text-blue-500" },
};

interface PomodoroTimerProps {
  onSessionComplete?: (durationMinutes: number) => void;
}

export function PomodoroTimer({ onSessionComplete }: PomodoroTimerProps) {
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(MODE_CONFIG.focus.minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const totalSeconds = MODE_CONFIG[mode].minutes * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  const handleComplete = useCallback(() => {
    setIsRunning(false);
    if (mode === "focus") {
      const elapsed = startedAtRef.current
        ? Math.floor((Date.now() - startedAtRef.current) / 60000)
        : MODE_CONFIG.focus.minutes;
      setCompletedPomodoros((n) => n + 1);
      onSessionComplete?.(elapsed);
      toast.success("🍅 포모도로 완료! 휴식을 취하세요.", { duration: 5000 });
      // 4번마다 긴 휴식
      const next: Mode = (completedPomodoros + 1) % 4 === 0 ? "long_break" : "short_break";
      setMode(next);
      setSecondsLeft(MODE_CONFIG[next].minutes * 60);
    } else {
      toast.success("휴식 종료! 다시 집중해봐요.", { duration: 3000 });
      setMode("focus");
      setSecondsLeft(MODE_CONFIG.focus.minutes * 60);
    }
    startedAtRef.current = null;
  }, [mode, completedPomodoros, onSessionComplete]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            handleComplete();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, handleComplete]);

  function handleStart() {
    if (!isRunning) startedAtRef.current = Date.now();
    setIsRunning(!isRunning);
  }

  function handleReset() {
    setIsRunning(false);
    setSecondsLeft(MODE_CONFIG[mode].minutes * 60);
    startedAtRef.current = null;
  }

  function handleSkip() {
    setIsRunning(false);
    handleComplete();
  }

  function switchMode(m: Mode) {
    setIsRunning(false);
    setMode(m);
    setSecondsLeft(MODE_CONFIG[m].minutes * 60);
    startedAtRef.current = null;
  }

  const config = MODE_CONFIG[mode];

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>🍅 포모도로 타이머</span>
          <span className="text-sm font-normal text-muted-foreground">
            완료: {completedPomodoros}회
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 모드 선택 */}
        <div className="flex gap-1">
          {(Object.keys(MODE_CONFIG) as Mode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => switchMode(m)}
            >
              {MODE_CONFIG[m].label}
            </Button>
          ))}
        </div>

        {/* 타이머 디스플레이 */}
        <div className="text-center space-y-2">
          <div className={cn("text-6xl font-mono font-bold tabular-nums", config.color)}>
            {minutes}:{seconds}
          </div>
          <p className="text-sm text-muted-foreground">{config.label} 타이머</p>
        </div>

        {/* 진행 바 */}
        <Progress value={progress} className="h-2" />

        {/* 컨트롤 */}
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={handleStart} className="px-8">
            {isRunning ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {isRunning ? "일시정지" : "시작"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSkip}>
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* 포모도로 점 표시 */}
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                i < completedPomodoros % 4 ? "bg-red-500" : "bg-muted"
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
