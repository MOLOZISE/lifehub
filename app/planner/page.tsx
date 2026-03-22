"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2,
  Edit2, Trash2, MapPin, Clock, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = "캘린더" | "기록" | "운세";

interface CalendarEvent {
  id: string; title: string; date: string;
  startTime?: string; endTime?: string; isAllDay: boolean;
  category: string; color: string; memo?: string;
  location?: string; travelTime?: number; duration?: number;
}
interface DiaryEntry { date: string; content: string; mood?: string; tags: string[]; }
interface GoalItem  { id: string; title: string; done: boolean; }
interface Plan      { period: string; type: string; goals: GoalItem[]; reflection?: string; }
interface MiniFortuneData {
  overall?: string; score?: number; luckyColor?: string; luckyNumber?: number;
  advice?: string; cached?: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const WEEK_DAYS = ["일","월","화","수","목","금","토"];

const EVENT_CATEGORIES = [
  { key: "personal", label: "개인",  color: "bg-violet-500" },
  { key: "work",     label: "업무",  color: "bg-blue-500"   },
  { key: "study",    label: "학습",  color: "bg-green-500"  },
  { key: "health",   label: "건강",  color: "bg-red-500"    },
  { key: "social",   label: "약속",  color: "bg-amber-500"  },
  { key: "etc",      label: "기타",  color: "bg-gray-400"   },
];

const EVENT_COLOR: Record<string, string> = {
  personal:"bg-violet-500", work:"bg-blue-500", study:"bg-green-500",
  health:"bg-red-500", social:"bg-amber-500", etc:"bg-gray-400",
};

const MOODS = [
  { key:"great",   emoji:"😄", label:"최고", color:"text-green-500"  },
  { key:"good",    emoji:"🙂", label:"좋음", color:"text-lime-500"   },
  { key:"neutral", emoji:"😐", label:"보통", color:"text-gray-500"   },
  { key:"bad",     emoji:"😕", label:"나쁨", color:"text-orange-500" },
  { key:"terrible",emoji:"😢", label:"최악", color:"text-red-500"    },
];

function localToday() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function buildMonthDays(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days  = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2,"0")}`);
  return cells;
}

function getWeekPeriod(d: Date): string {
  const dt = new Date(d); dt.setHours(0,0,0,0);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
  const y = dt.getFullYear();
  const soy = new Date(y, 0, 1);
  const wn = Math.ceil(((dt.getTime() - soy.getTime()) / 86400000 + soy.getDay() + 1) / 7);
  return `${y}-W${String(wn).padStart(2,"00")}`;
}

function cid() { return Math.random().toString(36).slice(2,10); }

// ── Event Dialog ───────────────────────────────────────────────────────────────

interface EventForm {
  title:string; date:string; startTime:string; endTime:string; isAllDay:boolean;
  category:string; memo:string; location:string; travelTime:string; duration:string;
}

const EMPTY_FORM: EventForm = {
  title:"", date:localToday(), startTime:"", endTime:"", isAllDay:true,
  category:"personal", memo:"", location:"", travelTime:"", duration:"",
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const today = localToday();
  const [tab, setTab] = useState<Tab>("캘린더");

  // ── Calendar state ──────────────────────────────────────────────────────────
  const [calMonth, setCalMonth]       = useState(today.slice(0,7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents]           = useState<CalendarEvent[]>([]);
  const [studyMap, setStudyMap]       = useState<Record<string,number>>({});
  const [yearGoals, setYearGoals]     = useState<GoalItem[]>([]);
  const [yearRefl, setYearRefl]       = useState("");
  const [newYearGoal, setNewYearGoal] = useState("");
  // Inline event form state
  const [inlineEventOpen, setInlineEventOpen] = useState(false);
  const [inlineEventForm, setInlineEventForm] = useState<EventForm>(EMPTY_FORM);
  const [editingEventId, setEditingEventId] = useState<string|null>(null);
  // Inline diary from calendar tab
  const [inlineDiaryOpen, setInlineDiaryOpen] = useState(false);

  // ── Diary/record state ──────────────────────────────────────────────────────
  const [recDate, setRecDate]         = useState(today);
  const [diary, setDiary]             = useState<DiaryEntry>({ date:today, content:"", tags:[] });
  const [recPlan, setRecPlan]         = useState<Plan>({ period:today, type:"day", goals:[], reflection:"" });
  const [newDayGoal, setNewDayGoal]   = useState("");
  const [diarySaving, setDiarySaving] = useState(false);
  const [monthDiaries, setMonthDiaries] = useState<DiaryEntry[]>([]);

  // ── Fortune mini state ──────────────────────────────────────────────────────
  const [miniFortune, setMiniFortune] = useState<MiniFortuneData | null>(null);
  // ── Week/month memo state ────────────────────────────────────────────────────
  const [weekMemo, setWeekMemo]       = useState("");
  const [monthMemo, setMonthMemo]     = useState("");
  const [weekMemoOpen, setWeekMemoOpen] = useState(false);

  // ── Load calendar ───────────────────────────────────────────────────────────
  const loadCalendar = useCallback(async (month: string) => {
    const [evRes, stRes] = await Promise.all([
      fetch(`/api/planner/events?month=${month}`),
      fetch(`/api/study/sessions?month=${month}`),
    ]);
    if (evRes.ok) { const d = await evRes.json(); setEvents(d.events ?? []); }
    if (stRes.ok) {
      const d = await stRes.json();
      const map: Record<string,number> = {};
      for (const s of (d.sessions ?? [])) map[s.date] = (map[s.date]??0) + (s.durationMinutes??0);
      setStudyMap(map);
    }
  }, []);

  useEffect(() => { loadCalendar(calMonth); }, [calMonth, loadCalendar]);

  // ── Load year plan + week/month memos ──────────────────────────────────────
  useEffect(() => {
    const year = today.slice(0,4);
    const weekPeriod = getWeekPeriod(new Date());
    const monthPeriod = today.slice(0,7);
    Promise.all([
      fetch(`/api/planner/plans?type=year&period=${year}`).then(r=>r.json()),
      fetch(`/api/planner/plans?type=week&period=${weekPeriod}`).then(r=>r.json()),
      fetch(`/api/planner/plans?type=month&period=${monthPeriod}`).then(r=>r.json()),
    ]).then(([yRes, wRes, mRes]) => {
      if (yRes.plan) {
        setYearGoals(yRes.plan.goals ?? []);
        setYearRefl(yRes.plan.reflection ?? "");
      }
      if (wRes.plan) setWeekMemo(wRes.plan.reflection ?? "");
      if (mRes.plan) setMonthMemo(mRes.plan.reflection ?? "");
    });
  }, [today]);

  // ── Load diary + day plan ───────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "기록") return;
    Promise.all([
      fetch(`/api/planner/diary?date=${recDate}`).then(r=>r.json()),
      fetch(`/api/planner/plans?type=day&period=${recDate}`).then(r=>r.json()),
      fetch(`/api/planner/diary?month=${recDate.slice(0,7)}`).then(r=>r.json()),
    ]).then(([dRes, pRes, mRes]) => {
      if (dRes.entry) setDiary({ date:recDate, content:dRes.entry.content, mood:dRes.entry.mood, tags:dRes.entry.tags??[] });
      else            setDiary({ date:recDate, content:"", tags:[] });
      if (pRes.plan)  setRecPlan(pRes.plan);
      else            setRecPlan({ period:recDate, type:"day", goals:[], reflection:"" });
      setMonthDiaries(mRes.entries ?? []);
    });
  }, [recDate, tab]);

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const monthDays = buildMonthDays(calMonth);
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) (eventsByDate[e.date] ??= []).push(e);
  const selectedEvents = eventsByDate[selectedDate] ?? [];

  function prevMonth() { const d=new Date(calMonth+"-01"); d.setMonth(d.getMonth()-1); setCalMonth(d.toISOString().slice(0,7)); }
  function nextMonth() { const d=new Date(calMonth+"-01"); d.setMonth(d.getMonth()+1); setCalMonth(d.toISOString().slice(0,7)); }

  async function saveEvent(ev: CalendarEvent) {
    if (ev.id) {
      await fetch(`/api/planner/events/${ev.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(ev) });
      setEvents(es => es.map(e => e.id===ev.id ? ev : e));
    } else {
      const res = await fetch("/api/planner/events", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(ev) });
      const saved = await res.json();
      setEvents(es => [...es, saved]);
    }
    toast.success("일정 저장됨");
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/planner/events/${id}`, { method:"DELETE" });
    setEvents(es => es.filter(e => e.id!==id));
    toast.success("삭제됨");
  }

  const sif = (k: keyof EventForm, v: string | boolean) =>
    setInlineEventForm(f => ({ ...f, [k]: v }));

  function openInlineAdd() {
    setInlineEventForm({ ...EMPTY_FORM, date: selectedDate });
    setEditingEventId(null);
    setInlineEventOpen(true);
  }

  function openInlineEdit(ev: CalendarEvent) {
    setInlineEventForm({
      title: ev.title, date: ev.date,
      startTime: ev.startTime ?? "", endTime: ev.endTime ?? "",
      isAllDay: ev.isAllDay, category: ev.category,
      memo: ev.memo ?? "", location: ev.location ?? "",
      travelTime: ev.travelTime != null ? String(ev.travelTime) : "",
      duration: ev.duration != null ? String(ev.duration) : "",
    });
    setEditingEventId(ev.id);
    setInlineEventOpen(true);
  }

  async function submitInlineEvent() {
    if (!inlineEventForm.title.trim()) return;
    const ev: CalendarEvent = {
      id: editingEventId ?? "",
      title: inlineEventForm.title.trim(), date: inlineEventForm.date,
      startTime: inlineEventForm.startTime || undefined,
      endTime: inlineEventForm.endTime || undefined,
      isAllDay: inlineEventForm.isAllDay, category: inlineEventForm.category,
      color: EVENT_COLOR[inlineEventForm.category] ?? "bg-gray-400",
      memo: inlineEventForm.memo || undefined,
      location: inlineEventForm.location || undefined,
      travelTime: inlineEventForm.travelTime ? Number(inlineEventForm.travelTime) : undefined,
      duration: inlineEventForm.duration ? Number(inlineEventForm.duration) : undefined,
    };
    await saveEvent(ev);
    setInlineEventOpen(false);
    setEditingEventId(null);
  }

  async function saveYearPlan(goals: GoalItem[], reflection: string) {
    await fetch("/api/planner/plans", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ type:"year", period:today.slice(0,4), goals, reflection }) });
  }

  function addYearGoal() {
    if (!newYearGoal.trim()) return;
    const goals = [...yearGoals, { id:cid(), title:newYearGoal.trim(), done:false }];
    setYearGoals(goals); setNewYearGoal(""); saveYearPlan(goals, yearRefl);
  }

  function toggleYearGoal(id: string) {
    const goals = yearGoals.map(g => g.id===id ? {...g, done:!g.done} : g);
    setYearGoals(goals); saveYearPlan(goals, yearRefl);
  }

  // ── Diary / record helpers ──────────────────────────────────────────────────
  async function saveDiary() {
    setDiarySaving(true);
    try {
      await fetch("/api/planner/diary", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(diary) });
      toast.success("저장됨");
    } finally { setDiarySaving(false); }
  }

  async function saveRecPlan(plan: Plan) {
    setRecPlan(plan);
    await fetch("/api/planner/plans", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(plan) });
  }

  function addDayGoal() {
    if (!newDayGoal.trim()) return;
    const goals = [...recPlan.goals, { id:cid(), title:newDayGoal.trim(), done:false }];
    saveRecPlan({ ...recPlan, goals }); setNewDayGoal("");
  }

  function toggleDayGoal(id: string) {
    const goals = recPlan.goals.map(g => g.id===id ? {...g, done:!g.done} : g);
    saveRecPlan({ ...recPlan, goals });
  }

  // ── Fortune mini load (cache only) ──────────────────────────────────────────
  useEffect(() => {
    if (tab !== "운세") return;
    fetch("/api/planner/fortune?type=daily").then(r => r.json()).then(d => {
      if (d.cached) setMiniFortune(d);
    }).catch(() => {});
  }, [tab]);

  // ── Render helpers ──────────────────────────────────────────────────────────
  const studyBg = ["bg-muted","bg-green-200 dark:bg-green-900/50","bg-green-300 dark:bg-green-700","bg-green-500/70","bg-green-700 dark:bg-green-500"];
  const studyInt = (m:number) => m===0?0:m<30?1:m<60?2:m<120?3:4;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">

      {/* Title + Tabs */}
      <div>
        <h1 className="text-xl font-bold mb-3">📅 플래너</h1>
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {(["캘린더","기록","운세"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                tab===t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t==="캘린더"?"📅 캘린더":t==="기록"?"📓 기록":"🔮 운세"}
            </button>
          ))}
        </div>
      </div>

      {/* ── 캘린더 탭 ─────────────────────────────────────────────────── */}
      {tab==="캘린더" && (
        <div className="space-y-4">

          {/* 연간 목표 배너 */}
          <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>🎯 {today.slice(0,4)}년 목표</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {yearGoals.filter(g=>g.done).length}/{yearGoals.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {yearGoals.length>0 && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all"
                    style={{ width:`${yearGoals.length>0?(yearGoals.filter(g=>g.done).length/yearGoals.length)*100:0}%` }} />
                </div>
              )}
              <div className="space-y-1">
                {yearGoals.map(g => (
                  <div key={g.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={g.done} onChange={() => toggleYearGoal(g.id)} className="rounded" />
                    <span className={`text-xs flex-1 ${g.done?"line-through text-muted-foreground":""}`}>{g.title}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="연간 목표 추가..." value={newYearGoal}
                  onChange={e => setNewYearGoal(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && addYearGoal()}
                  className="h-7 text-xs" />
                <Button size="sm" className="h-7 px-2 text-xs" onClick={addYearGoal} disabled={!newYearGoal.trim()}>추가</Button>
              </div>
            </CardContent>
          </Card>

          {/* 주간/월간 메모 */}
          <div>
            <button
              onClick={() => setWeekMemoOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <span>📝 주간 메모</span>
              <span className="ml-auto">{weekMemoOpen ? "▲" : "▼"}</span>
            </button>
            {weekMemoOpen && (
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">이번 주 메모</p>
                  <Textarea
                    placeholder="이번 주 계획, 회고, 메모..."
                    value={weekMemo}
                    onChange={e => setWeekMemo(e.target.value)}
                    className="h-16 text-xs resize-none"
                  />
                  <Button size="sm" className="h-7 text-xs mt-1" onClick={async () => {
                    const period = getWeekPeriod(new Date());
                    await fetch("/api/planner/plans", { method:"POST", headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({ type:"week", period, goals:[], reflection: weekMemo }) });
                    toast.success("주간 메모 저장됨");
                  }}>저장</Button>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">이번 달 메모</p>
                  <Textarea
                    placeholder="이번 달 목표, 회고, 메모..."
                    value={monthMemo}
                    onChange={e => setMonthMemo(e.target.value)}
                    className="h-16 text-xs resize-none"
                  />
                  <Button size="sm" className="h-7 text-xs mt-1" onClick={async () => {
                    const period = today.slice(0,7);
                    await fetch("/api/planner/plans", { method:"POST", headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({ type:"month", period, goals:[], reflection: monthMemo }) });
                    toast.success("월간 메모 저장됨");
                  }}>저장</Button>
                </div>
              </div>
            )}
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-semibold text-sm">{calMonth.replace("-","년 ")}월</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {WEEK_DAYS.map((d,i) => (
              <div key={d} className={`text-center text-[10px] font-medium pb-1 ${i===0?"text-red-500":i===6?"text-blue-500":"text-muted-foreground"}`}>{d}</div>
            ))}
            {monthDays.map((day,i) => {
              if (!day) return <div key={`e${i}`} />;
              const mins = studyMap[day]??0;
              const evs  = eventsByDate[day]??[];
              const isToday    = day===today;
              const isSelected = day===selectedDate;
              const dow = new Date(day+"T00:00:00").getDay();
              return (
                <button key={day} onClick={() => setSelectedDate(day)}
                  className={`aspect-square flex flex-col items-start justify-start p-0.5 rounded-xl transition-all
                    ${studyBg[studyInt(mins)]}
                    ${isToday?"ring-2 ring-primary":""}
                    ${isSelected&&!isToday?"ring-2 ring-primary/40":""}
                    hover:brightness-95`}>
                  <span className={`text-[10px] font-bold ml-0.5 mt-0.5 leading-none
                    ${isToday?"text-primary":dow===0?"text-red-500":dow===6?"text-blue-500":studyInt(mins)>2?"text-white":"text-muted-foreground"}`}>
                    {day.slice(8).replace(/^0/,"")}
                  </span>
                  <div className="flex flex-col gap-px mt-0.5 w-full px-0.5">
                    {evs.slice(0,2).map(ev => (
                      <div key={ev.id} className={`w-full h-1 rounded-full ${ev.color}`} />
                    ))}
                    {evs.length>2 && <span className="text-[8px] text-muted-foreground leading-none">+{evs.length-2}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected date detail + inline event form */}
          <Card>
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">
                {selectedDate.replace(/-/g,". ")}
                {studyMap[selectedDate]?<span className="ml-2 text-xs text-green-600 font-normal">📚 {studyMap[selectedDate]}분</span>:null}
              </CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                  onClick={() => { setInlineDiaryOpen(o => !o); }}>
                  ✏️ 기록
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                  onClick={() => inlineEventOpen ? setInlineEventOpen(false) : openInlineAdd()}>
                  <Plus className="w-3 h-3" />{inlineEventOpen && !editingEventId ? "닫기" : "일정"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-2">
              {/* Event list */}
              {selectedEvents.length===0 && !inlineEventOpen
                ? <p className="text-xs text-muted-foreground text-center py-2">일정이 없습니다</p>
                : selectedEvents.map(ev => (
                  <div key={ev.id} className={`flex items-center gap-2 p-2 rounded-lg bg-muted/40 group ${editingEventId===ev.id?"ring-1 ring-primary":""}`}>
                    <div className={`w-2 h-2 rounded-full ${ev.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{ev.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {!ev.isAllDay && ev.startTime && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />{ev.startTime}{ev.endTime?` ~ ${ev.endTime}`:""}
                          </span>
                        )}
                        {ev.location && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />{ev.location}
                          </span>
                        )}
                        {ev.travelTime && <span className="text-[10px] text-muted-foreground">🚇 {ev.travelTime}분</span>}
                      </div>
                      {ev.memo && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{ev.memo}</p>}
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openInlineEdit(ev)} className="p-1 hover:text-primary"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => deleteEvent(ev.id)} className="p-1 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))
              }

              {/* ── 인라인 이벤트 폼 ── */}
              {inlineEventOpen && (
                <div className="border rounded-xl p-3 space-y-2.5 bg-muted/20 mt-1">
                  <p className="text-xs font-semibold text-muted-foreground">{editingEventId ? "일정 편집" : "일정 추가"}</p>

                  <Input placeholder="제목 *" value={inlineEventForm.title}
                    onChange={e => sif("title", e.target.value)} autoFocus className="h-8 text-sm" />

                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={inlineEventForm.date}
                      onChange={e => sif("date", e.target.value)} className="h-8 text-sm" />
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer self-center">
                      <input type="checkbox" checked={inlineEventForm.isAllDay}
                        onChange={e => sif("isAllDay", e.target.checked)} className="rounded" />
                      하루 종일
                    </label>
                  </div>

                  {!inlineEventForm.isAllDay && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="time" value={inlineEventForm.startTime}
                        onChange={e => sif("startTime", e.target.value)} className="h-8 text-sm" />
                      <Input type="time" value={inlineEventForm.endTime}
                        onChange={e => sif("endTime", e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {EVENT_CATEGORIES.map(c => (
                      <button key={c.key} type="button" onClick={() => sif("category", c.key)}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-all ${
                          inlineEventForm.category === c.key
                            ? `${c.color} text-white border-transparent`
                            : "border-muted-foreground/30 text-muted-foreground"
                        }`}>{c.label}</button>
                    ))}
                  </div>

                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="위치 (선택)" value={inlineEventForm.location}
                      onChange={e => sif("location", e.target.value)} className="h-8 text-sm pl-8" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" min="0" placeholder="이동시간 (분)" value={inlineEventForm.travelTime}
                      onChange={e => sif("travelTime", e.target.value)} className="h-8 text-sm" />
                    <Input type="number" min="0" placeholder="소요시간 (분)" value={inlineEventForm.duration}
                      onChange={e => sif("duration", e.target.value)} className="h-8 text-sm" />
                  </div>

                  <Textarea placeholder="메모 (선택)" value={inlineEventForm.memo}
                    onChange={e => sif("memo", e.target.value)} className="h-16 text-sm resize-none" />

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8" onClick={submitInlineEvent}
                      disabled={!inlineEventForm.title.trim()}>저장</Button>
                    <Button size="sm" variant="outline" className="h-8 px-3"
                      onClick={() => { setInlineEventOpen(false); setEditingEventId(null); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── 인라인 기록 (일기 + 할일) ── */}
              {inlineDiaryOpen && (
                <div className="border rounded-xl p-3 space-y-2.5 bg-violet-50/50 dark:bg-violet-950/10 mt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">✏️ {selectedDate} 기록</p>
                    <button onClick={() => setInlineDiaryOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Textarea
                    placeholder="오늘 있었던 일, 생각, 감정을 자유롭게 기록하세요..."
                    value={diary.content}
                    onChange={e => setDiary(d => ({ ...d, content: e.target.value, date: selectedDate }))}
                    className="min-h-32 text-sm"
                  />
                  <Button size="sm" className="w-full h-8" onClick={async () => {
                    setDiarySaving(true);
                    try {
                      await fetch("/api/planner/diary", { method:"POST", headers:{"Content-Type":"application/json"},
                        body: JSON.stringify({ ...diary, date: selectedDate }) });
                      toast.success("기록 저장됨");
                      setInlineDiaryOpen(false);
                    } finally { setDiarySaving(false); }
                  }} disabled={diarySaving || !diary.content.trim()}>
                    {diarySaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}저장
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 기록 탭 ──────────────────────────────────────────────────── */}
      {tab==="기록" && (
        <div className="space-y-4">
          {/* Date selector */}
          <div className="flex items-center gap-2">
            <button onClick={() => { const d=new Date(recDate); d.setDate(d.getDate()-1); setRecDate(d.toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"})); }}
              className="p-1.5 rounded-lg hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
            <Input type="date" value={recDate} onChange={e => setRecDate(e.target.value)} className="flex-1 h-9 text-sm text-center" />
            <button onClick={() => { const d=new Date(recDate); d.setDate(d.getDate()+1); setRecDate(d.toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"})); }}
              className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {/* Today's events summary */}
          {(eventsByDate[recDate]??[]).length>0 && (
            <Card className="bg-muted/30">
              <CardContent className="p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">📅 이날 일정</p>
                {(eventsByDate[recDate]??[]).map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full ${ev.color} shrink-0`} />
                    <span className="font-medium">{ev.title}</span>
                    {ev.location && <span className="text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5"/>{ev.location}</span>}
                    {!ev.isAllDay && ev.startTime && <span className="text-muted-foreground ml-auto">{ev.startTime}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Day goals */}
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm">✅ 오늘 할 일</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {recPlan.goals.length===0 && <p className="text-xs text-muted-foreground text-center py-2">할 일을 추가해보세요</p>}
              {recPlan.goals.map(g => (
                <div key={g.id} className="flex items-center gap-2 group">
                  <input type="checkbox" checked={g.done} onChange={() => toggleDayGoal(g.id)} className="rounded" />
                  <span className={`flex-1 text-sm ${g.done?"line-through text-muted-foreground":""}`}>{g.title}</span>
                  <button onClick={() => saveRecPlan({ ...recPlan, goals:recPlan.goals.filter(x=>x.id!==g.id) })}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <Input placeholder="할 일 추가..." value={newDayGoal} onChange={e => setNewDayGoal(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && addDayGoal()} className="h-8 text-sm" />
                <Button size="sm" className="h-8 px-3" onClick={addDayGoal} disabled={!newDayGoal.trim()}>+</Button>
              </div>
              {recPlan.goals.length>0 && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width:`${(recPlan.goals.filter(g=>g.done).length/recPlan.goals.length)*100}%` }} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mood */}
          <div>
            <p className="text-xs font-medium mb-2 text-muted-foreground">오늘의 기분</p>
            <div className="flex gap-2">
              {MOODS.map(m => (
                <button key={m.key} onClick={() => setDiary(d=>({...d, mood:m.key}))}
                  className={`flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl border transition-all ${
                    diary.mood===m.key?"border-primary bg-primary/10":"border-muted hover:border-muted-foreground/30"
                  }`}>
                  <span className="text-lg">{m.emoji}</span>
                  <span className={`text-[10px] font-medium ${m.color}`}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Diary */}
          <div>
            <p className="text-xs font-medium mb-1.5 text-muted-foreground">📝 오늘의 기록</p>
            <Textarea placeholder="오늘 있었던 일, 생각, 감정을 기록해보세요..." value={diary.content}
              onChange={e => setDiary(d=>({...d, content:e.target.value}))}
              className="min-h-48 text-sm" />
          </div>

          <Button className="w-full" onClick={saveDiary} disabled={diarySaving||!diary.content.trim()}>
            {diarySaving?<Loader2 className="w-4 h-4 animate-spin mr-1"/>:null}저장
          </Button>

          {/* Past diary list */}
          {monthDiaries.filter(e=>e.date!==recDate).length>0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">이번 달 기록</p>
              <div className="space-y-1.5">
                {monthDiaries.filter(e=>e.date!==recDate).slice(0,5).map(e => {
                  const mood = MOODS.find(m=>m.key===e.mood);
                  return (
                    <button key={e.date} onClick={() => setRecDate(e.date)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl border bg-background hover:bg-muted/40 text-left transition-colors">
                      <span className="text-base">{mood?.emoji??"📓"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{e.date}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.content.slice(0,50)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 운세 탭 ──────────────────────────────────────────────────── */}
      {tab==="운세" && (
        <div className="space-y-4">
          {/* Mini fortune summary (cached only) */}
          {miniFortune ? (
            <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌅</span>
                  <span className="font-semibold text-sm flex-1">오늘의 운세</span>
                  {miniFortune.score && <Badge>{miniFortune.score}점</Badge>}
                </div>
                {miniFortune.overall && <p className="text-sm leading-relaxed">{miniFortune.overall}</p>}
                {miniFortune.advice && <p className="text-xs text-muted-foreground italic border-l-4 border-violet-300 pl-3">{miniFortune.advice}</p>}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {miniFortune.luckyColor && <Badge variant="outline">🎨 {miniFortune.luckyColor}</Badge>}
                  {miniFortune.luckyNumber != null && <Badge variant="outline">🔢 {miniFortune.luckyNumber}</Badge>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-muted-foreground">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">아직 오늘의 운세가 없어요</p>
              </CardContent>
            </Card>
          )}
          <Link href="/fortune">
            <Button className="w-full gap-2">
              <Sparkles className="w-4 h-4" />운세 페이지로 이동
            </Button>
          </Link>
        </div>
      )}

    </div>
  );
}
