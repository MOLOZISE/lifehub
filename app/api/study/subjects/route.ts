import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subjects = await prisma.subject.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { notes: true, flashcards: true, quizQuestions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(subjects);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, color, emoji, examDate } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const subject = await prisma.subject.create({
    data: {
      userId: session.user.id,
      name,
      color: color ?? "blue",
      emoji: emoji ?? null,
      examDate: examDate ? examDate : null,
    },
    include: {
      _count: {
        select: { notes: true, flashcards: true, quizQuestions: true },
      },
    },
  });

  return NextResponse.json(subject, { status: 201 });
}
