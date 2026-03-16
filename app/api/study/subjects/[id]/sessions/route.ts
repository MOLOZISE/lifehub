import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const sessions = await prisma.quizSession.findMany({
    where: { subjectId: id, userId: session.user.id },
    orderBy: { completedAt: "asc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { questionIds, answers, score, total, durationSeconds } = body;

  const quizSession = await prisma.quizSession.create({
    data: {
      userId: session.user.id,
      subjectId: id,
      questionIds: questionIds ?? [],
      answers: answers ?? [],
      score: score ?? 0,
      total: total ?? 0,
      durationSeconds: durationSeconds ?? 0,
    },
  });

  return NextResponse.json(quizSession, { status: 201 });
}
