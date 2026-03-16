import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exams = await prisma.exam.findMany({
    where: { userId: session.user.id },
    orderBy: { examDate: "asc" },
  });

  return NextResponse.json(exams);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, category, examDate, targetScore, passScore, actualScore, status, memo } = body;

  if (!name || !examDate) return NextResponse.json({ error: "name and examDate are required" }, { status: 400 });

  const exam = await prisma.exam.create({
    data: {
      userId: session.user.id,
      name,
      category: category || null,
      examDate: new Date(examDate),
      targetScore: targetScore ? Number(targetScore) : null,
      passScore: passScore ? Number(passScore) : null,
      actualScore: actualScore ? Number(actualScore) : null,
      status: status ?? "upcoming",
      memo: memo || null,
    },
  });

  return NextResponse.json(exam, { status: 201 });
}
