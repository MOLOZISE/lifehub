import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const userId = session.user.id;
  const data = await req.json();

  try {
    // Subjects (먼저 생성 — 나머지가 참조)
    if (data.subjects?.length) {
      await prisma.subject.createMany({
        data: data.subjects.map((s: { id: string; name: string; description: string; color: string; emoji: string; examDate?: string; lastStudiedAt?: string; createdAt: string; updatedAt: string }) => ({
          id: s.id, userId, name: s.name, description: s.description,
          color: s.color, emoji: s.emoji, examDate: s.examDate,
          lastStudiedAt: s.lastStudiedAt ? new Date(s.lastStudiedAt) : null,
          createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt),
        })),
        skipDuplicates: true,
      });
    }

    // Notes
    if (data.notes?.length) {
      await prisma.note.createMany({
        data: data.notes.map((n: { id: string; subjectId: string; title: string; content: string; tags: string[]; isPinned: boolean; createdAt: string; updatedAt: string }) => ({
          id: n.id, userId, subjectId: n.subjectId, title: n.title,
          content: n.content, tags: n.tags, isPinned: n.isPinned,
          createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt),
        })),
        skipDuplicates: true,
      });
    }

    // Flashcards
    if (data.flashcards?.length) {
      await prisma.flashcard.createMany({
        data: data.flashcards.map((f: { id: string; subjectId: string; front: string; back: string; tags: string[]; interval: number; easeFactor: number; nextReviewAt: string; reviewCount: number; known: boolean; createdAt: string }) => ({
          id: f.id, userId, subjectId: f.subjectId, front: f.front, back: f.back,
          tags: f.tags, interval: f.interval, easeFactor: f.easeFactor,
          nextReviewAt: new Date(f.nextReviewAt), reviewCount: f.reviewCount,
          known: f.known, createdAt: new Date(f.createdAt),
        })),
        skipDuplicates: true,
      });
    }

    // Quiz Questions
    if (data.questions?.length) {
      await prisma.quizQuestion.createMany({
        data: data.questions.map((q: { id: string; subjectId: string; type: string; question: string; options?: string[]; answer: string; explanation: string; tags: string[]; wrongCount: number; lastAnsweredAt?: string; createdAt: string }) => ({
          id: q.id, userId, subjectId: q.subjectId, type: q.type,
          question: q.question, options: q.options ?? [], answer: q.answer,
          explanation: q.explanation, tags: q.tags, wrongCount: q.wrongCount,
          lastAnsweredAt: q.lastAnsweredAt ? new Date(q.lastAnsweredAt) : null,
          createdAt: new Date(q.createdAt),
        })),
        skipDuplicates: true,
      });
    }

    // Exams (StudySession 이전에 생성)
    if (data.exams?.length) {
      for (const e of data.exams) {
        await prisma.exam.upsert({
          where: { id: e.id },
          update: {},
          create: {
            id: e.id, userId, name: e.name, category: e.category,
            examDate: e.examDate, targetScore: e.targetScore, passScore: e.passScore,
            memo: e.memo, status: e.status, actualScore: e.actualScore,
            createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt),
          },
        });
        if (e.subjectIds?.length) {
          await prisma.examSubject.createMany({
            data: e.subjectIds.map((sid: string) => ({ examId: e.id, subjectId: sid })),
            skipDuplicates: true,
          });
        }
      }
    }

    // Study Sessions
    if (data.studySessions?.length) {
      await prisma.studySession.createMany({
        data: data.studySessions.map((s: { id: string; subjectId: string; examId?: string; date: string; materialName?: string; activityType: string; durationMinutes: number; pagesOrQuestions?: number; correctRate?: number; focusScore: number; fatigueScore: number; satisfactionScore: number; memo?: string; createdAt: string }) => ({
          id: s.id, userId, subjectId: s.subjectId, examId: s.examId ?? null,
          date: s.date, materialName: s.materialName, activityType: s.activityType,
          durationMinutes: s.durationMinutes, pagesOrQuestions: s.pagesOrQuestions,
          correctRate: s.correctRate, focusScore: s.focusScore,
          fatigueScore: s.fatigueScore, satisfactionScore: s.satisfactionScore,
          memo: s.memo, createdAt: new Date(s.createdAt),
        })),
        skipDuplicates: true,
      });
    }

    // Wrong Answers
    if (data.wrongAnswers?.length) {
      await prisma.wrongAnswerNote.createMany({
        data: data.wrongAnswers.map((w: { id: string; subjectId: string; examId?: string; questionText: string; myAnswer?: string; correctAnswer: string; explanation?: string; reason: string; tags: string[]; reviewCount: number; lastReviewedAt?: string; nextReviewAt: string; resolved: boolean; createdAt: string }) => ({
          id: w.id, userId, subjectId: w.subjectId, examId: w.examId ?? null,
          questionText: w.questionText, myAnswer: w.myAnswer,
          correctAnswer: w.correctAnswer, explanation: w.explanation,
          reason: w.reason, tags: w.tags, reviewCount: w.reviewCount,
          lastReviewedAt: w.lastReviewedAt ? new Date(w.lastReviewedAt) : null,
          nextReviewAt: new Date(w.nextReviewAt), resolved: w.resolved,
          createdAt: new Date(w.createdAt),
        })),
        skipDuplicates: true,
      });
    }

    // Holdings
    if (data.holdings?.length) {
      await prisma.holding.createMany({
        data: data.holdings.map((h: { id: string; ticker: string; name: string; market: string; sector?: string; quantity: number; avgPrice: number; currentPrice: number; currency: string; memo?: string }) => ({
          id: h.id, userId, ticker: h.ticker, name: h.name, market: h.market,
          sector: h.sector, quantity: h.quantity, avgPrice: h.avgPrice,
          currentPrice: h.currentPrice, currency: h.currency, memo: h.memo,
        })),
        skipDuplicates: true,
      });
    }

    // Strategy Memos
    if (data.strategyMemos?.length) {
      await prisma.strategyMemo.createMany({
        data: data.strategyMemos.map((m: { id: string; ticker: string; title: string; content: string; createdAt: string; updatedAt: string }) => ({
          id: m.id, userId, ticker: m.ticker, title: m.title, content: m.content,
          createdAt: new Date(m.createdAt), updatedAt: new Date(m.updatedAt),
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[migrate]", error);
    return NextResponse.json({ error: "마이그레이션 중 오류가 발생했습니다." }, { status: 500 });
  }
}
