"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Play, CheckCircle, XCircle, Trash2, Upload, Timer, RotateCcw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSubjectById, getQuestions, saveQuestions, getSessions, saveSessions } from "@/lib/storage";
import { generateId } from "@/lib/utils-app";
import type { QuizQuestion, QuizSession, Subject, QuestionType } from "@/lib/types";

type Mode = "list" | "quiz" | "result" | "add";
type FilterMode = "all" | "wrong" | "tag";

function normalizeAnswer(q: QuizQuestion, userAnswer: string): boolean {
  if (q.type === "multiple") return userAnswer === q.answer;
  if (q.type === "ox") return userAnswer.toUpperCase() === q.answer.toUpperCase();
  return userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
}

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [mode, setMode] = useState<Mode>("list");
  // Filter
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [filterTag, setFilterTag] = useState("");
  const [randomOrder, setRandomOrder] = useState(true);
  const [useTimer, setUseTimer] = useState(false);
  // Quiz state
  const [queue, setQueue] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<{ qId: string; answer: string; correct: boolean }[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Add form
  const [addType, setAddType] = useState<QuestionType>("multiple");
  const [addQ, setAddQ] = useState("");
  const [addOpts, setAddOpts] = useState(["","","",""]);
  const [addAnswer, setAddAnswer] = useState("");
  const [addExpl, setAddExpl] = useState("");
  const [addTags, setAddTags] = useState("");

  useEffect(() => {
    setSubject(getSubjectById(id) ?? null);
    setQuestions(getQuestions(id));
  }, [id]);

  useEffect(() => {
    if (mode === "quiz" && useTimer) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [mode, useTimer]);

  const allTags = Array.from(new Set(questions.flatMap(q => q.tags)));

  function buildQueue(): QuizQuestion[] {
    let pool = [...questions];
    if (filterMode === "wrong") pool = pool.filter(q => q.wrongCount > 0);
    if (filterMode === "tag" && filterTag) pool = pool.filter(q => q.tags.includes(filterTag));
    return randomOrder ? pool.sort(() => Math.random() - 0.5) : pool;
  }

  function startQuiz() {
    const q = buildQueue();
    if (q.length === 0) return;
    setQueue(q);
    setCurrent(0);
    setUserAnswer("");
    setSubmitted(false);
    setAnswers([]);
    setElapsed(0);
    setMode("quiz");
  }

  function handleSubmit() {
    if (!userAnswer) return;
    const q = queue[current];
    const correct = normalizeAnswer(q, userAnswer);
    setSubmitted(true);
    setAnswers(prev => [...prev, { qId: q.id, answer: userAnswer, correct }]);
    if (!correct) {
      const updated = questions.map(qq => qq.id === q.id ? { ...qq, wrongCount: qq.wrongCount + 1, lastAnsweredAt: new Date().toISOString() } : qq);
      setQuestions(updated);
      saveQuestions(id, updated);
    }
  }

  function handleNext() {
    if (current + 1 >= queue.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      const score = answers.filter(a => a.correct).length + (answers.length < queue.length ? (normalizeAnswer(queue[current], userAnswer) ? 1 : 0) : 0);
      const session: QuizSession = {
        id: generateId(), subjectId: id,
        questionIds: queue.map(q => q.id),
        answers: answers.map(a => a.answer),
        score: answers.filter(a => a.correct).length,
        total: queue.length,
        durationSeconds: elapsed,
        completedAt: new Date().toISOString(),
      };
      const prev = getSessions(id);
      saveSessions(id, [...prev, session]);
      setMode("result");
    } else {
      setCurrent(c => c + 1);
      setUserAnswer("");
      setSubmitted(false);
    }
  }

  function handleAddQuestion() {
    if (!addQ.trim() || !addAnswer.trim()) return;
    const q: QuizQuestion = {
      id: generateId(), subjectId: id,
      type: addType, question: addQ,
      options: addType === "multiple" ? addOpts.filter(Boolean) : undefined,
      answer: addAnswer, explanation: addExpl,
      tags: addTags.split(",").map(t => t.trim()).filter(Boolean),
      wrongCount: 0, createdAt: new Date().toISOString(),
    };
    const next = [...questions, q];
    setQuestions(next);
    saveQuestions(id, next);
    setAddQ(""); setAddOpts(["","","",""]); setAddAnswer(""); setAddExpl(""); setAddTags(""); setMode("list");
  }

  function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n").slice(1); // skip header
      const imported: QuizQuestion[] = [];
      lines.forEach(line => {
        const cols = line.split(",");
        if (cols.length < 7) return;
        const [type, question, o1, o2, o3, o4, answer, explanation, ...tagParts] = cols;
        imported.push({
          id: generateId(), subjectId: id,
          type: (type?.trim() || "multiple") as QuestionType,
          question: question?.trim() || "",
          options: type?.trim() === "multiple" ? [o1,o2,o3,o4].map(o => o?.trim()).filter(Boolean) : undefined,
          answer: answer?.trim() || "",
          explanation: explanation?.trim() || "",
          tags: tagParts.join(",").split(",").map(t => t.trim()).filter(Boolean),
          wrongCount: 0, createdAt: new Date().toISOString(),
        });
      });
      const next = [...questions, ...imported];
      setQuestions(next);
      saveQuestions(id, next);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  function handleDelete(qId: string) {
    const next = questions.filter(q => q.id !== qId);
    setQuestions(next);
    saveQuestions(id, next);
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  // ─── Quiz screen ──────────────────────────────────────────────────────────
  if (mode === "quiz" && queue.length > 0) {
    const q = queue[current];
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setMode("list"); if (timerRef.current) clearInterval(timerRef.current); }}>
            <ArrowLeft className="w-4 h-4 mr-1" />그만하기
          </Button>
          <div className="flex items-center gap-3">
            {useTimer && <span className="font-mono text-sm">{pad(Math.floor(elapsed/60))}:{pad(elapsed%60)}</span>}
            <span className="text-sm text-muted-foreground">{current+1}/{queue.length}</span>
          </div>
        </div>
        <Progress value={((current+1)/queue.length)*100} />
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-2">
              <Badge variant="outline">{q.type === "multiple" ? "객관식" : q.type === "ox" ? "O/X" : "단답형"}</Badge>
              {q.wrongCount > 0 && <Badge variant="destructive">오답 {q.wrongCount}회</Badge>}
            </div>
            <p className="font-semibold text-base leading-relaxed">{q.question}</p>

            {q.type === "multiple" && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const letter = ["①","②","③","④","⑤"][i];
                  const isCorrect = submitted && opt === q.answer;
                  const isWrong = submitted && opt === userAnswer && opt !== q.answer;
                  return (
                    <button key={i} onClick={() => !submitted && setUserAnswer(opt)}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors
                        ${!submitted && userAnswer === opt ? "border-primary bg-primary/10" : ""}
                        ${!submitted && userAnswer !== opt ? "hover:bg-accent" : ""}
                        ${isCorrect ? "bg-green-50 border-green-500 dark:bg-green-950" : ""}
                        ${isWrong ? "bg-red-50 border-red-500 dark:bg-red-950" : ""}
                      `}
                    >
                      <span className="font-medium mr-2">{letter}</span>{opt}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "ox" && (
              <div className="flex gap-4">
                {["O","X"].map(v => (
                  <button key={v} onClick={() => !submitted && setUserAnswer(v)}
                    className={`flex-1 py-6 text-4xl font-bold rounded-xl border-2 transition-all
                      ${!submitted && userAnswer === v ? "border-primary bg-primary/10" : "hover:bg-accent"}
                      ${submitted && v === q.answer ? "border-green-500 bg-green-50 dark:bg-green-950" : ""}
                      ${submitted && v === userAnswer && v !== q.answer ? "border-red-500 bg-red-50 dark:bg-red-950" : ""}
                    `}
                  >{v}</button>
                ))}
              </div>
            )}

            {q.type === "short" && (
              <Input
                placeholder="정답을 입력하세요"
                value={userAnswer}
                onChange={e => !submitted && setUserAnswer(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !submitted && handleSubmit()}
                className={submitted ? (normalizeAnswer(q, userAnswer) ? "border-green-500" : "border-red-500") : ""}
              />
            )}

            {submitted && (
              <div className={`rounded-lg p-3 text-sm ${normalizeAnswer(q, userAnswer) ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"}`}>
                <p className="font-medium">{normalizeAnswer(q, userAnswer) ? "✓ 정답입니다!" : `✗ 오답 (정답: ${q.answer})`}</p>
                {q.explanation && <p className="mt-1 text-xs opacity-80">{q.explanation}</p>}
              </div>
            )}

            {!submitted
              ? <Button className="w-full" onClick={handleSubmit} disabled={!userAnswer}>제출</Button>
              : <Button className="w-full" onClick={handleNext}>{current+1 < queue.length ? "다음 문제" : "결과 보기"}</Button>
            }
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Result screen ────────────────────────────────────────────────────────
  if (mode === "result") {
    const score = answers.filter(a => a.correct).length;
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-center">결과</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <Card><CardContent className="p-4"><p className="text-3xl font-bold">{score}</p><p className="text-xs text-muted-foreground">정답</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-3xl font-bold">{queue.length - score}</p><p className="text-xs text-muted-foreground">오답</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-3xl font-bold">{pad(Math.floor(elapsed/60))}:{pad(elapsed%60)}</p><p className="text-xs text-muted-foreground">소요 시간</p></CardContent></Card>
        </div>
        <Progress value={(score/queue.length)*100} className="h-3" />
        <div className="space-y-2">
          {answers.filter(a => !a.correct).map((a, i) => {
            const q = queue.find(q => q.id === a.qId);
            return (
              <div key={i} className="flex gap-2 p-3 rounded-lg border border-red-200 dark:border-red-900">
                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm">{q?.question}</p>
                  <p className="text-xs text-muted-foreground">내 답: {a.answer} → 정답: {q?.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={startQuiz}><RotateCcw className="w-4 h-4 mr-2" />다시 풀기</Button>
          <Button onClick={() => setMode("list")}>목록으로</Button>
        </div>
      </div>
    );
  }

  // ─── Add form ─────────────────────────────────────────────────────────────
  if (mode === "add") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setMode("list")}><ArrowLeft className="w-4 h-4" /></Button>
          <h2 className="font-semibold">문제 추가</h2>
        </div>
        <Tabs value={addType} onValueChange={v => setAddType(v as QuestionType)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="multiple">객관식</TabsTrigger>
            <TabsTrigger value="ox">O/X</TabsTrigger>
            <TabsTrigger value="short">단답형</TabsTrigger>
          </TabsList>
        </Tabs>
        <Textarea placeholder="문제 내용" value={addQ} onChange={e => setAddQ(e.target.value)} rows={3} />
        {addType === "multiple" && addOpts.map((opt, i) => (
          <Input key={i} placeholder={`선택지 ${i+1}`} value={opt} onChange={e => { const n=[...addOpts]; n[i]=e.target.value; setAddOpts(n); }} />
        ))}
        {addType === "ox" ? (
          <div className="flex gap-3">
            {["O","X"].map(v => (
              <button key={v} onClick={() => setAddAnswer(v)} className={`flex-1 py-3 text-2xl font-bold rounded-lg border-2 ${addAnswer === v ? "border-primary bg-primary/10" : "border-muted"}`}>{v}</button>
            ))}
          </div>
        ) : (
          <Input placeholder="정답" value={addAnswer} onChange={e => setAddAnswer(e.target.value)} />
        )}
        <Textarea placeholder="해설 (선택)" value={addExpl} onChange={e => setAddExpl(e.target.value)} rows={2} />
        <Input placeholder="태그 (쉼표 구분)" value={addTags} onChange={e => setAddTags(e.target.value)} />
        <Button onClick={handleAddQuestion} className="w-full" disabled={!addQ.trim() || !addAnswer.trim()}>추가</Button>
      </div>
    );
  }

  // ─── List screen ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <LinkButton variant="ghost" size="icon" href={`/study/subjects/${id}`}><ArrowLeft className="w-4 h-4" /></LinkButton>
        <h2 className="font-semibold">{subject?.emoji} {subject?.name} — 문제풀이</h2>
        <div className="ml-auto flex gap-2">
          <label className="cursor-pointer">
            <Button variant="outline" size="sm"><Upload className="w-3.5 h-3.5 mr-1" />CSV 가져오기</Button>
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          </label>
          <Button variant="outline" size="sm" onClick={() => setMode("add")}><Plus className="w-3.5 h-3.5 mr-1" />문제 추가</Button>
          <Button size="sm" onClick={startQuiz} disabled={questions.length === 0}><Play className="w-3.5 h-3.5 mr-1" />시작</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center text-sm">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {(["all","wrong","tag"] as FilterMode[]).map(f => (
          <Badge key={f} variant={filterMode === f ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterMode(f)}>
            {f === "all" ? "전체" : f === "wrong" ? "오답만" : "태그별"}
          </Badge>
        ))}
        {filterMode === "tag" && allTags.map(t => (
          <Badge key={t} variant={filterTag === t ? "secondary" : "outline"} className="cursor-pointer" onClick={() => setFilterTag(filterTag === t ? "" : t)}>{t}</Badge>
        ))}
        <label className="ml-2 flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={randomOrder} onChange={e => setRandomOrder(e.target.checked)} className="w-3.5 h-3.5" />
          랜덤
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)} className="w-3.5 h-3.5" />
          <Timer className="w-3 h-3" />타이머
        </label>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">🧠</p>
          <p>문제가 없습니다.</p>
          <p className="text-sm mt-1">문제를 추가하거나 CSV로 가져오세요.</p>
          <p className="text-xs mt-2 text-muted-foreground">CSV 형식: type,question,opt1,opt2,opt3,opt4,answer,explanation,tags</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <Card key={q.id}>
              <CardContent className="p-4 flex gap-3">
                <span className="text-muted-foreground text-sm font-medium w-6 shrink-0 mt-0.5">{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{q.type === "multiple" ? "객관식" : q.type === "ox" ? "O/X" : "단답형"}</Badge>
                    {q.wrongCount > 0 && <Badge variant="destructive" className="text-xs">오답 {q.wrongCount}회</Badge>}
                    {q.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                  </div>
                  <p className="text-sm">{q.question}</p>
                  <p className="text-xs text-green-600 mt-1">정답: {q.answer}</p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => handleDelete(q.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
