import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const note = await prisma.wrongAnswerNote.findUnique({ where: { id } });
  if (!note || note.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // "reviewed" action: increment reviewCount and schedule next review
  if (body.action === "reviewed") {
    const newCount = note.reviewCount + 1;
    const resolved = newCount >= 4;
    // Spaced repetition: 1, 3, 7, 14 days
    const intervals = [1, 3, 7, 14];
    const daysUntilNext = intervals[Math.min(newCount - 1, intervals.length - 1)];
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + daysUntilNext);

    const updated = await prisma.wrongAnswerNote.update({
      where: { id },
      data: { reviewCount: newCount, resolved, nextReviewAt, lastReviewedAt: new Date() },
    });
    return NextResponse.json({ ...updated, question: updated.questionText, wrongReason: updated.reason, isResolved: updated.resolved });
  }

  // General update
  const { question, myAnswer, correctAnswer, explanation, wrongReason, isResolved } = body;
  const updated = await prisma.wrongAnswerNote.update({
    where: { id },
    data: {
      questionText: question ?? note.questionText,
      myAnswer: myAnswer !== undefined ? myAnswer : note.myAnswer,
      correctAnswer: correctAnswer ?? note.correctAnswer,
      explanation: explanation !== undefined ? explanation : note.explanation,
      reason: wrongReason !== undefined ? wrongReason : note.reason,
      resolved: isResolved !== undefined ? isResolved : note.resolved,
    },
  });
  return NextResponse.json({ ...updated, question: updated.questionText, wrongReason: updated.reason, isResolved: updated.resolved });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const note = await prisma.wrongAnswerNote.findUnique({ where: { id } });
  if (!note || note.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.wrongAnswerNote.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
