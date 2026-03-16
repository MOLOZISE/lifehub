"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, HelpCircle, Layers, CalendarClock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { COLOR_MAP, formatDate } from "@/lib/utils-app";

interface SubjectDetail {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string | null;
  examDate: string | null;
  _count: { notes: number; flashcards: number; quizQuestions: number };
}

interface NotePreview { id: string; title: string; content: string; }
interface SessionSummary { id: string; score: number; total: number; }
interface FlashcardSummary { id: string; known: boolean; }

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [notes, setNotes] = useState<NotePreview[]>([]);
  const [lastSession, setLastSession] = useState<SessionSummary | null>(null);
  const [knownCount, setKnownCount] = useState(0);

  useEffect(() => {
    async function load() {
      const [subRes, notesRes, sessRes, cardsRes] = await Promise.all([
        fetch(`/api/study/subjects/${id}`),
        fetch(`/api/study/subjects/${id}/notes`),
        fetch(`/api/study/subjects/${id}/sessions`),
        fetch(`/api/study/subjects/${id}/flashcards`),
      ]);

      if (!subRes.ok) { router.push("/study/subjects"); return; }
      setSubject(await subRes.json());
      if (notesRes.ok) setNotes(await notesRes.json());
      if (sessRes.ok) {
        const sessions: SessionSummary[] = await sessRes.json();
        if (sessions.length > 0) setLastSession(sessions[sessions.length - 1]);
      }
      if (cardsRes.ok) {
        const cards: FlashcardSummary[] = await cardsRes.json();
        setKnownCount(cards.filter(c => c.known).length);
      }
    }
    load();
  }, [id, router]);

  if (!subject) return null;

  const colors = COLOR_MAP[subject.color] ?? COLOR_MAP["blue"];
  const { notes: noteCount, flashcards: flashcardCount, quizQuestions: questionCount } = subject._count;

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
          {subject.description && (
            <p className="text-muted-foreground mt-1">{subject.description}</p>
          )}
          {subject.examDate && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" />시험일: {formatDate(subject.examDate)}
            </p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
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
            {lastSession && (
              <p className="text-xs text-green-500 mt-0.5">{lastSession.score}/{lastSession.total}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Layers className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{flashcardCount}</p>
            <p className="text-xs text-muted-foreground">플래시카드</p>
            {flashcardCount > 0 && (
              <Progress value={flashcardCount > 0 ? (knownCount / flashcardCount) * 100 : 0} className="h-1 mt-1.5" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="notes">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="notes">노트</TabsTrigger>
          <TabsTrigger value="quiz">문제풀이</TabsTrigger>
          <TabsTrigger value="flashcard">플래시카드</TabsTrigger>
        </TabsList>
        <TabsContent value="notes" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">총 {noteCount}개</p>
            <LinkButton size="sm" href={`/study/subjects/${id}/notes`}>노트 관리</LinkButton>
          </div>
          {notes.slice(0, 3).map((note) => (
            <Link key={note.id} href={`/study/subjects/${id}/notes`}>
              <div className="p-3 rounded-lg border hover:bg-accent transition-colors mb-2">
                <p className="font-medium text-sm">{note.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{note.content}</p>
              </div>
            </Link>
          ))}
          {noteCount === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">노트가 없습니다.</p>
          )}
        </TabsContent>
        <TabsContent value="quiz" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">총 {questionCount}문제</p>
            <LinkButton size="sm" href={`/study/subjects/${id}/quiz`}>문제 풀기</LinkButton>
          </div>
          {questionCount === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">문제가 없습니다.</p>
          )}
        </TabsContent>
        <TabsContent value="flashcard" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">총 {flashcardCount}장 / {knownCount}장 암기완료</p>
            <LinkButton size="sm" href={`/study/subjects/${id}/flashcard`}>암기 시작</LinkButton>
          </div>
          {flashcardCount === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">플래시카드가 없습니다.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
