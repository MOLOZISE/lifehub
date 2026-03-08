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
import { getSubjectById, getNotes, getQuestions, getFlashcards, getSessions } from "@/lib/storage";
import { COLOR_MAP, formatDate } from "@/lib/utils-app";
import type { Subject } from "@/lib/types";

export default function SubjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [subject, setSubject] = useState<Subject | null>(null);

  useEffect(() => {
    const s = getSubjectById(id);
    if (!s) { router.push("/study/subjects"); return; }
    setSubject(s);
  }, [id, router]);

  if (!subject) return null;

  const notes = getNotes(id);
  const questions = getQuestions(id);
  const flashcards = getFlashcards(id);
  const known = flashcards.filter((f) => f.known).length;
  const sessions = getSessions(id);
  const lastSession = sessions[sessions.length - 1];
  const colors = COLOR_MAP[subject.color];

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
            <p className="text-2xl font-bold">{notes.length}</p>
            <p className="text-xs text-muted-foreground">노트</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <HelpCircle className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{questions.length}</p>
            <p className="text-xs text-muted-foreground">문제</p>
            {lastSession && (
              <p className="text-xs text-green-500 mt-0.5">{lastSession.score}/{lastSession.total}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Layers className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{flashcards.length}</p>
            <p className="text-xs text-muted-foreground">플래시카드</p>
            {flashcards.length > 0 && (
              <Progress value={flashcards.length > 0 ? (known / flashcards.length) * 100 : 0} className="h-1 mt-1.5" />
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
            <p className="text-sm text-muted-foreground">총 {notes.length}개</p>
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
          {notes.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">노트가 없습니다.</p>
          )}
        </TabsContent>
        <TabsContent value="quiz" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">총 {questions.length}문제</p>
            <LinkButton size="sm" href={`/study/subjects/${id}/quiz`}>문제 풀기</LinkButton>
          </div>
          {questions.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">문제가 없습니다.</p>
          )}
        </TabsContent>
        <TabsContent value="flashcard" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">총 {flashcards.length}장 / {known}장 암기완료</p>
            <LinkButton size="sm" href={`/study/subjects/${id}/flashcard`}>암기 시작</LinkButton>
          </div>
          {flashcards.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">플래시카드가 없습니다.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
