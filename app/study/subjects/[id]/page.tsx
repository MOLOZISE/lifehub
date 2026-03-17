"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, HelpCircle, Layers, CalendarClock, Clock, XCircle, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { COLOR_MAP, formatDate } from "@/lib/utils-app";

interface SubjectDetail {
  id: string; name: string; emoji: string; color: string;
  description: string | null; examDate: string | null;
  _count: { notes: number; flashcards: number; quizQuestions: number };
}
interface NotePreview { id: string; title: string; content: string; }
interface QuizSession { id: string; score: number; total: number; completedAt: string; durationSeconds: number | null; }
interface FlashcardSummary { id: string; known: boolean; }
interface WrongAnswer { id: string; question: string; wrongReason: string | null; isResolved: boolean; nextReviewAt: string | null; }

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [knownCount, setKnownCount] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);

  useEffect(() => {
    async function load() {
      const [subRes, notesRes, sessRes, cardsRes, wrongRes] = await Promise.all([
        fetch(`/api/study/subjects/${id}`),
        fetch(`/api/study/subjects/${id}/notes`),
        fetch(`/api/study/subjects/${id}/sessions`),
        fetch(`/api/study/subjects/${id}/flashcards`),
        fetch(`/api/study/wrong-answers?subjectId=${id}`),
      ]);
      if (!subRes.ok) { router.push("/study/subjects"); return; }
      setSubject(await subRes.json());
      if (notesRes.ok) setNotes(await notesRes.json());
      if (sessRes.ok) setSessions(await sessRes.json());
      if (cardsRes.ok) {
        const cards: FlashcardSummary[] = await cardsRes.json();
        setKnownCount(cards.filter(c => c.known).length);
      }
      if (wrongRes.ok) {
        const data = await wrongRes.json();
        setWrongAnswers(Array.isArray(data) ? data : data.notes ?? []);
      }
    }
    load();
  }, [id, router]);

  if (!subject) return null;

  const colors = COLOR_MAP[subject.color as import("@/lib/types").SubjectColor] ?? COLOR_MAP["blue"];
  const { notes: noteCount, flashcards: flashcardCount, quizQuestions: questionCount } = subject._count;
  const lastSession = sessions[sessions.length - 1];
  const unresolvedWrong = wrongAnswers.filter(w => !w.isResolved).length;

  // D-Day 계산
  const dDay = subject.examDate
    ? Math.ceil((new Date(subject.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <LinkButton variant="ghost" size="icon" href="/study/subjects"><ArrowLeft className="w-4 h-4" /></LinkButton>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-3xl">{subject.emoji}</span>
            <h1 className="text-2xl font-bold">{subject.name}</h1>
            <Badge className={`${colors.bg} text-white border-0`}>{subject.color}</Badge>
          </div>
          {subject.description && <p className="text-muted-foreground mt-1">{subject.description}</p>}
          {subject.examDate && (
            <p className="text-sm mt-1 flex items-center gap-1.5 font-medium">
              <CalendarClock className="w-4 h-4 text-orange-500" />
              시험일: {formatDate(subject.examDate)}
              {dDay !== null && (
                <Badge variant={dDay <= 7 ? "destructive" : dDay <= 30 ? "secondary" : "outline"} className="ml-1">
                  {dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-Day" : "종료"}
                </Badge>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{noteCount}</p>
            <p className="text-xs text-muted-foreground">노트</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <HelpCircle className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{questionCount}</p>
            <p className="text-xs text-muted-foreground">문제</p>
            {lastSession && <p className="text-xs text-green-500 mt-0.5">{lastSession.score}/{lastSession.total}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Layers className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{flashcardCount}</p>
            <p className="text-xs text-muted-foreground">플래시카드</p>
            {flashcardCount > 0 && <Progress value={(knownCount / flashcardCount) * 100} className="h-1 mt-1.5" />}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="w-5 h-5 mx-auto mb-1 text-red-400" />
            <p className="text-2xl font-bold">{unresolvedWrong}</p>
            <p className="text-xs text-muted-foreground">미해결 오답</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="notes">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="notes">📝 노트</TabsTrigger>
          <TabsTrigger value="quiz">🧩 문제풀이</TabsTrigger>
          <TabsTrigger value="flashcard">🃏 플래시카드</TabsTrigger>
          <TabsTrigger value="sessions">📋 세션</TabsTrigger>
          <TabsTrigger value="wrong">❌ 오답</TabsTrigger>
        </TabsList>

        {/* 노트 */}
        <TabsContent value="notes" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">총 {noteCount}개</p>
            <LinkButton size="sm" href={`/study/subjects/${id}/notes`}>노트 관리</LinkButton>
          </div>
          {notes.slice(0, 5).map((note) => (
            <Link key={note.id} href={`/study/subjects/${id}/notes`}>
              <div className="p-3 rounded-lg border hover:bg-accent transition-colors mb-2">
                <p className="font-medium text-sm">{note.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{note.content}</p>
              </div>
            </Link>
          ))}
          {noteCount === 0 && <p className="text-center text-muted-foreground py-8 text-sm">노트가 없습니다.</p>}
        </TabsContent>

        {/* 문제풀이 */}
        <TabsContent value="quiz" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">총 {questionCount}문제</p>
            <LinkButton size="sm" href={`/study/subjects/${id}/quiz`}>문제 풀기</LinkButton>
          </div>
          {questionCount === 0 && <p className="text-center text-muted-foreground py-8 text-sm">문제가 없습니다.</p>}
        </TabsContent>

        {/* 플래시카드 */}
        <TabsContent value="flashcard" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">총 {flashcardCount}장 / {knownCount}장 암기완료</p>
            <LinkButton size="sm" href={`/study/subjects/${id}/flashcard`}>암기 시작</LinkButton>
          </div>
          {flashcardCount > 0 && <Progress value={(knownCount / flashcardCount) * 100} className="h-2 mb-3" />}
          {flashcardCount === 0 && <p className="text-center text-muted-foreground py-8 text-sm">플래시카드가 없습니다.</p>}
        </TabsContent>

        {/* 세션 기록 */}
        <TabsContent value="sessions" className="mt-4">
          <p className="text-sm text-muted-foreground mb-3">총 {sessions.length}회 풀이</p>
          {sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">아직 풀이 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {[...sessions].reverse().map((s, i) => {
                const pct = s.total > 0 ? Math.round((s.score / s.total) * 100) : 0;
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <span className="text-xs text-muted-foreground w-6 text-right">{sessions.length - i}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{s.score}/{s.total}점</span>
                        <Badge variant={pct >= 80 ? "default" : pct >= 60 ? "secondary" : "destructive"} className="text-xs">
                          {pct}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.completedAt ? new Date(s.completedAt).toLocaleDateString("ko-KR") : "-"}
                        {s.durationSeconds && ` · ${Math.floor(s.durationSeconds / 60)}분`}
                      </p>
                    </div>
                    <Progress value={pct} className="w-20 h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 오답 노트 */}
        <TabsContent value="wrong" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">
              미해결 {unresolvedWrong}개 / 전체 {wrongAnswers.length}개
            </p>
          </div>
          {wrongAnswers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">오답 노트가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {wrongAnswers.map((w) => (
                <div key={w.id} className="p-3 border rounded-lg">
                  <div className="flex items-start gap-2">
                    {w.isResolved
                      ? <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{w.question}</p>
                      {w.wrongReason && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          <Clock className="inline w-3 h-3 mr-0.5" />{w.wrongReason}
                        </p>
                      )}
                    </div>
                    {!w.isResolved && w.nextReviewAt && (
                      <span className="text-xs text-orange-500 shrink-0">
                        {new Date(w.nextReviewAt).toLocaleDateString("ko-KR")} 복습
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
