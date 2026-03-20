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

  const subject = await prisma.subject.findFirst({
    where: { id, userId: session.user.id },
    include: {
      _count: {
        select: { notes: true, flashcards: true, quizQuestions: true },
      },
    },
  });

  if (!subject) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(subject);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, color, emoji, examDate } = body;

  const subject = await prisma.subject.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(emoji !== undefined && { emoji }),
      examDate: examDate ? examDate : null,
    },
  });

  if (subject.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.subject.findFirst({
    where: { id, userId: session.user.id },
    include: {
      _count: {
        select: { notes: true, flashcards: true, quizQuestions: true },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // 연결된 시험도 함께 삭제
  await prisma.exam.deleteMany({ where: { subjectId: id } }).catch(() => {});

  const result = await prisma.subject.deleteMany({
    where: { id, userId: session.user.id },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
