import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month");
  const subjectId = searchParams.get("subjectId");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const sessions = await prisma.studySession.findMany({
    where: {
      userId: session.user.id,
      ...(date ? { date } : month ? { date: { startsWith: month } } : {}),
      ...(subjectId ? { subjectId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { subject: { select: { id: true, name: true, emoji: true } } },
  });

  return NextResponse.json({ sessions, total: sessions.length });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    subjectId, examId, date, activityType, durationMinutes,
    pagesOrQuestions, correctRate, focusScore, fatigueScore,
    satisfactionScore, materialName, memo,
  } = body;

  if (!date || !activityType || !durationMinutes) {
    return NextResponse.json({ error: "date, activityType, durationMinutes are required" }, { status: 400 });
  }

  const studySession = await prisma.studySession.create({
    data: {
      userId: session.user.id,
      subjectId: subjectId || null,
      examId: examId || null,
      date,
      activityType,
      durationMinutes: Number(durationMinutes),
      pagesOrQuestions: pagesOrQuestions ? Number(pagesOrQuestions) : null,
      correctRate: correctRate ? Number(correctRate) : null,
      focusScore: focusScore ? Number(focusScore) : 0,
      fatigueScore: fatigueScore ? Number(fatigueScore) : 0,
      satisfactionScore: satisfactionScore ? Number(satisfactionScore) : 0,
      materialName: materialName || null,
      memo: memo || null,
    },
  });

  return NextResponse.json(studySession, { status: 201 });
}
