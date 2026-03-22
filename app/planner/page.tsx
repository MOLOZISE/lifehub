"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Loader2, RefreshCw, Edit2, Trash2, Smile, Meh, Frown, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = "캘린더" | "계획" | "일기" | "운세";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  category: string;
  color: string;
  memo?: string;
}

interface DiaryEntry {
  id?: string;
  date: string;
  content: string;
  mood?: string;
  tags: string[];
}

interface GoalItem { id: string; title: string; done: boolean; priority: "high" | "mid" | "low"; }
interface Plan { period: string; type: string; goals: GoalItem[]; reflection?: string; }

interface FortuneData {
  overall?: string;
  score?: number;
  categories?: Record<string, string>;
  luckyColor?: string;
  luckyNumber?: number;
  luckyFood?: string;
  advice?: string;
  // tarot
  cards?: Array<{ position: string; name: string; meaning: string; advice: string }>;
  // saju
  caution?: string;
  luckyDirection?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EVENT_CATEGORIES = [
  { key: "personal", label: "개인", color: "bg-violet-500" },
  { key: "work",     label: "업무", color: "bg-blue-500"   },
  { key: "study",    label: "학습", color: "bg-green-500"  },
  { key: "health",   label: "건강", color: "bg-red-500"    },
  { key: "social",   label: "약속", color: "bg-amber-500"  },
  { key: "etc",      label: "기타", color: "bg-gray-400"   },
];

const MOODS = [
  { key: "great",    label: "최고", emoji: "😄", color: "text-green-500" },
  { key: "good",     label: "좋음", emoji: "🙂", color: "text-lime-500"  },
  { key: "neutral",  label: "보통", emoji: "😐", color: "text-gray-500"  },
  { key: "bad",      label: "나쁨", emoji: "😕", color: "text-orange-500"},
  { key: "terrible", label: "최악", emoji: "😢", color: "text-red-500"   },
];

const EVENT_COLORS: Record<string, string> = {
  personal: "bg-violet-500", work: "bg-blue-500", study: "bg-green-500",
  health: "bg-red-500", social: "bg-amber-500", etc: "bg-gray-400",
};

function localToday() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function buildMonthDays(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay(); // 0=Sun
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  return cells;
}

function getWeekPeriod(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

function cuid() { return Math.random().toString(36).slice(2); }

// ── Event Dialog ───────────────────────────────────────────────────────────────

function EventDialog({ open, onClose, initial, defaultDate, onSave }: {
  open: boolean; onClose: () => void;
  initial?: CalendarEvent; defaultDate?: string;
  onSave: (e: CalendarEvent) => void;
}) {
  const [form, setForm] = useState({ title: "", date: defaultDate ?? localToday(), startTime: "", endTime: "", isAllDay: true, category: "personal", memo: "" });
  useEffect(() => {
    if (open) setForm(initial ? {
      title: initial.title, date: initial.date, startTime: initial.startTime ?? "",
      endTime: initial.endTime ?? "", isAllDay: initial.isAllDay, category: initial.category, memo: initial.memo ?? ""
    } : { title: "", date: defaultDate ?? localToday(), startTime: "", endTime: "", isAllDay: true, category: "personal", memo: "" });
  }, [open, initial, defaultDate]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{initial ? "일정 편집" : "일정 추가"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="제목 *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <div className="flex items-center gap-2 text-sm">
            <input type="checkbox" id="allday" checked={form.isAllDay} onChange={e => setForm(f => ({ ...f, isAllDay: e.target.checked }))} />
            <label htmlFor="allday">하루 종일</label>
          </div>
          {!form.isAllDay && (
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} placeholder="시작" />
              <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} placeholder="종료" />
            </div>
          )}
          <div>
            <p className="text-xs font-medium mb-1.5">카테고리</p>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setForm(f => ({ ...f, category: c.key }))}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${form.category === c.key ? `${c.color} text-white border-transparent` : "border-muted-foreground/30 text-muted-foreground"}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <Textarea placeholder="메모 (선택)" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className="h-16 text-sm resize-none" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={() => { if (!form.title.trim()) return; onSave({ id: initial?.id ?? "", ...form, color: EVENT_COLORS[form.category] ?? "bg-gray-400" }); onClose(); }} disabled={!form.title.trim()}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const [tab, setTab] = useState<Tab>("캘린더");
  const today = localToday();
  const [calMonth, setCalMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);

  // Calendar
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [studyMap, setStudyMap] = useState<Record<string, number>>({}); // date → minutes
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);

  // Diary
  const [diaryDate, setDiaryDate] = useState(today);
  const [diary, setDiary] = useState<DiaryEntry>({ date: today, content: "", tags: [] });
  const [diarySaving, setDiarySaving] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);

  // Plans
  const [planTab, setPlanTab] = useState<"week" | "month" | "year">("week");
  const [plan, setPlan] = useState<Plan>({ period: "", type: "week", goals: [], reflection: "" });
  const [planSaving, setPlanSaving] = useState(false);
  const [newGoal, setNewGoal] = useState("");

  // Fortune
  const [fortuneType, setFortuneType] = useState<"daily" | "tarot" | "saju">("daily");
  const [fortune, setFortune] = useState<FortuneData | null>(null);
  const [fortuneLoading, setFortuneLoading] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");

  // ── Load calendar events + study data ──────────────────────────────────────
  const loadCalendar = useCallback(async (month: string) => {
    const [evRes, stRes] = await Promise.all([
      fetch(`/api/planner/events?month=${month}`),
      fetch(`/api/study/sessions?month=${month}`),
    ]);
    if (evRes.ok) { const d = await evRes.json(); setEvents(d.events ?? []); }
    if (stRes.ok) {
      const d = await stRes.json();
      const map: Record<string, number> = {};
      for (const s of (d.sessions ?? [])) { map[s.date] = (map[s.date] ?? 0) + (s.durationMinutes ?? 0); }
      setStudyMap(map);
    }
  }, []);

  useEffect(() => { loadCalendar(calMonth); }, [calMonth, loadCalendar]);

  // ── Load diary ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "일기") return;
    fetch(`/api/planner/diary?date=${diaryDate}`)
      .then(r => r.json())
      .then(d => {
        if (d.entry) setDiary({ date: diaryDate, content: d.entry.content, mood: d.entry.mood, tags: d.entry.tags ?? [] });
        else setDiary({ date: diaryDate, content: "", tags: [] });
      });
    fetch(`/api/planner/diary?month=${diaryDate.slice(0, 7)}`)
      .then(r => r.json())
      .then(d => setDiaryEntries(d.entries ?? []));
  }, [diaryDate, tab]);

  // ── Load plan ───────────────────────────────────────────────────────────────
  const getPeriod = useCallback(() => {
    if (planTab === "week") return getWeekPeriod(new Date());
    if (planTab === "month") return today.slice(0, 7);
    return today.slice(0, 4);
  }, [planTab, today]);

  useEffect(() => {
    if (tab !== "계획") return;
    const period = getPeriod();
    fetch(`/api/planner/plans?type=${planTab}&period=${period}`)
      .then(r => r.json())
      .then(d => {
        if (d.plan) setPlan(d.plan);
        else setPlan({ period, type: planTab, goals: [], reflection: "" });
      });
  }, [planTab, tab, getPeriod]);

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const monthDays = buildMonthDays(calMonth);
  const dayEvents = events.filter(e => e.date === (dayDetailDate ?? selectedDate));
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) { (eventsByDate[e.date] ??= []).push(e); }

  function prevMonth() { const d = new Date(calMonth + "-01"); d.setMonth(d.getMonth() - 1); setCalMonth(d.toISOString().slice(0, 7)); }
  function nextMonth() { const d = new Date(calMonth + "-01"); d.setMonth(d.getMonth() + 1); setCalMonth(d.toISOString().slice(0, 7)); }

  async function saveEvent(ev: CalendarEvent) {
    if (ev.id) {
      await fetch(`/api/planner/events/${ev.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) });
      setEvents(es => es.map(e => e.id === ev.id ? ev : e));
    } else {
      const res = await fetch("/api/planner/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) });
      const saved = await res.json();
      setEvents(es => [...es, saved]);
    }
    toast.success("일정 저장됨");
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/planner/events/${id}`, { method: "DELETE" });
    setEvents(es => es.filter(e => e.id !== id));
    toast.success("일정 삭제됨");
  }

  // ── Diary helpers ───────────────────────────────────────────────────────────
  async function saveDiary() {
    setDiarySaving(true);
    try {
      await fetch("/api/planner/diary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(diary) });
      toast.success("일기 저장됨");
    } finally { setDiarySaving(false); }
  }

  // ── Plan helpers ────────────────────────────────────────────────────────────
  async function savePlan(updated: Plan) {
    setPlanSaving(true);
    try {
      await fetch("/api/planner/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      toast.success("계획 저장됨");
    } finally { setPlanSaving(false); }
  }

  function addGoal() {
    if (!newGoal.trim()) return;
    const updated = { ...plan, goals: [...plan.goals, { id: cuid(), title: newGoal.trim(), done: false, priority: "mid" as const }] };
    setPlan(updated); setNewGoal(""); savePlan(updated);
  }

  function toggleGoal(id: string) {
    const updated = { ...plan, goals: plan.goals.map(g => g.id === id ? { ...g, done: !g.done } : g) };
    setPlan(updated); savePlan(updated);
  }

  function deleteGoal(id: string) {
    const updated = { ...plan, goals: plan.goals.filter(g => g.id !== id) };
    setPlan(updated); savePlan(updated);
  }

  // ── Fortune helpers ─────────────────────────────────────────────────────────
  async function loadFortune(type: "daily" | "tarot" | "saju") {
    setFortune(null); setFortuneLoading(true);
    try {
      // check cache first
      const cached = await fetch(`/api/planner/fortune?type=${type}`).then(r => r.json());
      if (cached.cached && cached.overall !== undefined || cached.cards) { setFortune(cached); return; }

      const res = await fetch("/api/planner/fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, birthDate, birthTime }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setFortune(data);
    } catch { toast.error("운세 불러오기 실패"); }
    finally { setFortuneLoading(false); }
  }

  // ── Calendar cell render ────────────────────────────────────────────────────
  const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const studyIntensity = (mins: number) => mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;
  const studyBg = ["bg-muted", "bg-green-200 dark:bg-green-900/50", "bg-green-300 dark:bg-green-700/60", "bg-green-500/70", "bg-green-700 dark:bg-green-500"];

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      {/* Header + Tabs */}
      <div>
        <h1 className="text-xl font-bold mb-3">📅 플래너</h1>
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {(["캘린더", "계획", "일기", "운세"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t === "캘린더" ? "📅 캘린더" : t === "계획" ? "📋 계획" : t === "일기" ? "📓 일기" : "🔮 운세"}
            </button>
          ))}
        </div>
      </div>

      {/* ── 캘린더 탭 ─────────────────────────────────────────────────────── */}
      {tab === "캘린더" && (
        <div className="space-y-3">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-semibold text-sm">{calMonth.replace("-", "년 ")}월</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1">
            {WEEK_DAYS.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-medium pb-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"}`}>{d}</div>
            ))}
            {monthDays.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const mins = studyMap[day] ?? 0;
              const intensity = studyIntensity(mins);
              const isToday = day === today;
              const isSelected = day === selectedDate;
              const evs = eventsByDate[day] ?? [];
              const dow = new Date(day + "T00:00:00").getDay();
              return (
                <button key={day}
                  onClick={() => { setSelectedDate(day); setDayDetailDate(day); }}
                  className={`aspect-square flex flex-col items-start justify-start p-0.5 rounded-xl transition-all relative
                    ${studyBg[intensity]}
                    ${isToday ? "ring-2 ring-primary" : ""}
                    ${isSelected ? "ring-2 ring-primary/60" : ""}
                    hover:brightness-95`}>
                  <span className={`text-[10px] font-bold leading-none ml-0.5 mt-0.5 ${isToday ? "text-primary" : dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : intensity > 2 ? "text-white" : "text-muted-foreground"}`}>
                    {day.slice(8).replace(/^0/, "")}
                  </span>
                  <div className="flex flex-col gap-px mt-0.5 w-full">
                    {evs.slice(0, 2).map(ev => (
                      <div key={ev.id} className={`w-full h-1.5 rounded-full ${ev.color ?? "bg-violet-500"}`} />
                    ))}
                    {evs.length > 2 && <div className="text-[8px] text-muted-foreground leading-none ml-0.5">+{evs.length - 2}</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Day detail */}
          {dayDetailDate && (
            <Card>
              <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {dayDetailDate.replace(/-/g, ". ")}
                  {studyMap[dayDetailDate] ? <span className="ml-2 text-xs text-green-600 font-normal">📚 {studyMap[dayDetailDate]}분</span> : null}
                </CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setEditingEvent(undefined); setEventDialogOpen(true); }}>
                    <Plus className="w-3 h-3" />일정
                  </Button>
                  <button onClick={() => setDayDetailDate(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-1 space-y-1">
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">일정이 없습니다</p>
                ) : dayEvents.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 group">
                    <div className={`w-2 h-2 rounded-full ${ev.color ?? "bg-violet-500"} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{ev.title}</p>
                      {!ev.isAllDay && ev.startTime && <p className="text-[10px] text-muted-foreground">{ev.startTime}{ev.endTime ? ` ~ ${ev.endTime}` : ""}</p>}
                      {ev.memo && <p className="text-[10px] text-muted-foreground truncate">{ev.memo}</p>}
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingEvent(ev); setEventDialogOpen(true); }} className="p-1 hover:text-primary"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => deleteEvent(ev.id)} className="p-1 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Button className="w-full" variant="outline" size="sm" onClick={() => { setEditingEvent(undefined); setEventDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" />일정 추가
          </Button>
        </div>
      )}

      {/* ── 계획 탭 ──────────────────────────────────────────────────────── */}
      {tab === "계획" && (
        <div className="space-y-4">
          {/* Plan type tabs */}
          <div className="flex gap-1 bg-muted/40 rounded-xl p-1 text-xs">
            {(["week", "month", "year"] as const).map(t => (
              <button key={t} onClick={() => setPlanTab(t)}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${planTab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {t === "week" ? "이번 주" : t === "month" ? "이번 달" : "올해"}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">
                {planTab === "week" ? "🗓️ 주간 목표" : planTab === "month" ? "📆 월간 목표" : "🎯 연간 목표"}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{plan.period}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {/* Goal list */}
              <div className="space-y-1.5">
                {plan.goals.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">목표를 추가해보세요</p>}
                {plan.goals.map(g => (
                  <div key={g.id} className="flex items-center gap-2 group">
                    <input type="checkbox" checked={g.done} onChange={() => toggleGoal(g.id)} className="rounded" />
                    <span className={`flex-1 text-sm ${g.done ? "line-through text-muted-foreground" : ""}`}>{g.title}</span>
                    <button onClick={() => deleteGoal(g.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {/* Add goal */}
              <div className="flex gap-2">
                <Input placeholder="목표 추가..." value={newGoal} onChange={e => setNewGoal(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addGoal()} className="text-sm h-8" />
                <Button size="sm" className="h-8 px-3" onClick={addGoal} disabled={!newGoal.trim()}>추가</Button>
              </div>

              {/* Progress */}
              {plan.goals.length > 0 && (
                <div className="pt-1">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>달성률</span>
                    <span>{plan.goals.filter(g => g.done).length}/{plan.goals.length}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(plan.goals.filter(g => g.done).length / plan.goals.length) * 100}%` }} />
                  </div>
                </div>
              )}

              {/* Reflection */}
              <div className="pt-2 border-t">
                <p className="text-xs font-medium mb-1.5 text-muted-foreground">회고 / 메모</p>
                <Textarea placeholder="이 기간을 돌아보며..." value={plan.reflection ?? ""} onChange={e => setPlan(p => ({ ...p, reflection: e.target.value }))}
                  className="text-sm h-20 resize-none" />
                <Button size="sm" variant="outline" className="mt-2 w-full h-8 text-xs" onClick={() => savePlan(plan)} disabled={planSaving}>
                  {planSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}저장
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 일기 탭 ──────────────────────────────────────────────────────── */}
      {tab === "일기" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input type="date" value={diaryDate} onChange={e => { setDiaryDate(e.target.value); setDiary({ date: e.target.value, content: "", tags: [] }); }}
              className="flex-1 h-9 text-sm" />
            <Badge variant="outline" className="text-xs whitespace-nowrap">
              {["일","월","화","수","목","금","토"][new Date(diaryDate + "T00:00:00").getDay()]}요일
            </Badge>
          </div>

          {/* Mood */}
          <div>
            <p className="text-xs font-medium mb-2 text-muted-foreground">오늘의 기분</p>
            <div className="flex gap-2">
              {MOODS.map(m => (
                <button key={m.key} onClick={() => setDiary(d => ({ ...d, mood: m.key }))}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-all ${diary.mood === m.key ? "border-primary bg-primary/10" : "border-muted hover:border-muted-foreground/30"}`}>
                  <span className="text-lg">{m.emoji}</span>
                  <span className={`text-[10px] font-medium ${m.color}`}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <p className="text-xs font-medium mb-1.5 text-muted-foreground">오늘의 기록</p>
            <Textarea placeholder="오늘 있었던 일, 생각, 감정을 자유롭게 적어보세요..." value={diary.content}
              onChange={e => setDiary(d => ({ ...d, content: e.target.value }))} className="min-h-40 text-sm resize-none" />
          </div>

          <Button className="w-full" onClick={saveDiary} disabled={diarySaving || !diary.content.trim()}>
            {diarySaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}저장
          </Button>

          {/* Past entries */}
          {diaryEntries.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2">이번 달 기록</p>
              <div className="space-y-2">
                {diaryEntries.filter(e => e.date !== diaryDate).slice(0, 5).map(e => {
                  const mood = MOODS.find(m => m.key === e.mood);
                  return (
                    <button key={e.date} onClick={() => { setDiaryDate(e.date); setDiary(e); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border bg-background hover:bg-muted/40 text-left transition-colors">
                      <span className="text-lg">{mood?.emoji ?? "📓"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{e.date}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.content.slice(0, 50)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 운세 탭 ──────────────────────────────────────────────────────── */}
      {tab === "운세" && (
        <div className="space-y-4">
          {/* Fortune type */}
          <div className="flex gap-1 bg-muted/40 rounded-xl p-1 text-xs">
            {([
              { key: "daily", label: "🌅 오늘 운세" },
              { key: "tarot", label: "🃏 타로" },
              { key: "saju",  label: "☯️ 사주" },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => { setFortuneType(key); setFortune(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${fortuneType === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Saju birth info */}
          {fortuneType === "saju" && (
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">생년월일 (사주 분석용)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">생년월일</p>
                    <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">태어난 시각 (선택)</p>
                    <Input type="time" value={birthTime} onChange={e => setBirthTime(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Load button */}
          <Button className="w-full gap-2" onClick={() => loadFortune(fortuneType)} disabled={fortuneLoading || (fortuneType === "saju" && !birthDate)}>
            {fortuneLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {fortuneLoading ? "분석 중..." : fortune ? <><RefreshCw className="w-3.5 h-3.5" />새로 보기</> : "운세 보기"}
          </Button>

          {/* Fortune result */}
          {fortune && !fortuneLoading && (
            <div className="space-y-3">
              {/* Daily fortune */}
              {fortuneType === "daily" && (
                <>
                  {fortune.overall && (
                    <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-4 h-4 text-violet-500" />
                          <p className="font-semibold text-sm">{today} 오늘의 운세</p>
                          {fortune.score && <Badge className="ml-auto text-xs">{fortune.score}점</Badge>}
                        </div>
                        <p className="text-sm leading-relaxed">{fortune.overall}</p>
                      </CardContent>
                    </Card>
                  )}
                  {fortune.categories && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(fortune.categories).map(([k, v]) => (
                        <Card key={k} className="bg-muted/30">
                          <CardContent className="p-3">
                            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{k}</p>
                            <p className="text-xs leading-relaxed">{v}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {fortune.luckyColor && <Badge variant="outline">🎨 {fortune.luckyColor}</Badge>}
                    {fortune.luckyNumber != null && <Badge variant="outline">🔢 {fortune.luckyNumber}</Badge>}
                    {fortune.luckyFood && <Badge variant="outline">🍀 {fortune.luckyFood}</Badge>}
                  </div>
                  {fortune.advice && <p className="text-sm text-muted-foreground italic border-l-4 border-violet-300 pl-3">{fortune.advice}</p>}
                </>
              )}

              {/* Tarot */}
              {fortuneType === "tarot" && fortune.cards && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {fortune.cards.map((card, i) => (
                      <Card key={i} className="bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
                        <CardContent className="p-3 text-center">
                          <p className="text-[10px] text-amber-600 font-semibold mb-1">{card.position}</p>
                          <p className="text-[11px] font-bold mb-2 leading-tight">{card.name}</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{card.meaning}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {fortune.overall && <Card className="bg-muted/30"><CardContent className="p-4"><p className="text-xs font-medium mb-1">전체 흐름</p><p className="text-sm leading-relaxed">{fortune.overall as string}</p></CardContent></Card>}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {fortune.luckyColor && <Badge variant="outline">🎨 {fortune.luckyColor}</Badge>}
                    {fortune.luckyNumber != null && <Badge variant="outline">🔢 {fortune.luckyNumber}</Badge>}
                  </div>
                </>
              )}

              {/* Saju */}
              {fortuneType === "saju" && (
                <>
                  {fortune.overall && (
                    <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border-teal-200 dark:border-teal-800">
                      <CardContent className="p-4">
                        <p className="font-semibold text-sm mb-1">☯️ 오늘의 사주 운세</p>
                        <p className="text-sm leading-relaxed">{fortune.overall}</p>
                      </CardContent>
                    </Card>
                  )}
                  {fortune.categories && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(fortune.categories).map(([k, v]) => (
                        <Card key={k} className="bg-muted/30"><CardContent className="p-3">
                          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{k}</p>
                          <p className="text-xs leading-relaxed">{v}</p>
                        </CardContent></Card>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {fortune.luckyColor && <Badge variant="outline">🎨 {fortune.luckyColor}</Badge>}
                    {fortune.luckyNumber != null && <Badge variant="outline">🔢 {fortune.luckyNumber}</Badge>}
                    {fortune.luckyDirection && <Badge variant="outline">🧭 {fortune.luckyDirection}</Badge>}
                  </div>
                  {fortune.advice && <p className="text-sm leading-relaxed border-l-4 border-teal-300 pl-3">{fortune.advice}</p>}
                  {fortune.caution && <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">⚠️ {fortune.caution}</p>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Event Dialog */}
      <EventDialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        initial={editingEvent}
        defaultDate={dayDetailDate ?? selectedDate}
        onSave={saveEvent}
      />
    </div>
  );
}
