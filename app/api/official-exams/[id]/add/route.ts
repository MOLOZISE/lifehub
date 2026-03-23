import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/official-exams/[id]/add — 내 시험 일정에 추가
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const official = await prisma.officialExam.findUnique({ where: { id } });
  if (!official) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 이미 추가했는지 확인
  const existing = await prisma.exam.findFirst({
    where: { userId: session.user.id, officialExamId: id },
  });
  if (existing) return NextResponse.json({ error: "이미 추가된 시험입니다." }, { status: 409 });

  const exam = await prisma.exam.create({
    data: {
      userId: session.user.id,
      officialExamId: id,
      name: official.name,
      category: official.category,
      examDate: official.examDate,
      status: "upcoming",
    },
  });

  return NextResponse.json(exam, { status: 201 });
}
