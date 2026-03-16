import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");
  const isResolved = searchParams.get("isResolved");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (subjectId) where.subjectId = subjectId;
  if (isResolved !== null) where.resolved = isResolved === "true";

  const notes = await prisma.wrongAnswerNote.findMany({
    where,
    orderBy: { nextReviewAt: "asc" },
    include: { subject: { select: { id: true, name: true, color: true, emoji: true } } },
  });

  // Map DB field names to API field names for client compatibility
  const mapped = notes.map(n => ({
    ...n,
    question: n.questionText,
    wrongReason: n.reason,
    isResolved: n.resolved,
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subjectId, question, myAnswer, correctAnswer, explanation, wrongReason, sourceExamId } = body;

  if (!question || !correctAnswer) return NextResponse.json({ error: "question, correctAnswer required" }, { status: 400 });

  const note = await prisma.wrongAnswerNote.create({
    data: {
      userId: session.user.id,
      subjectId: subjectId || null,
      questionText: question,
      myAnswer: myAnswer || null,
      correctAnswer,
      explanation: explanation || null,
      reason: wrongReason || "concept_gap",
      nextReviewAt: new Date(),
    },
    include: { subject: { select: { id: true, name: true, color: true, emoji: true } } },
  });

  return NextResponse.json(note, { status: 201 });
}
