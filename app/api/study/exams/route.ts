import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exams = await prisma.exam.findMany({
    where: { userId: session.user.id },
    orderBy: { examDate: "asc" },
    include: {
      subject: { select: { id: true, name: true, emoji: true, color: true } },
      officialExam: { select: { id: true, examTypeId: true, examType: { select: { id: true, name: true, category: true } } } },
    },
  });

  return NextResponse.json(exams);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, category, examDate, targetScore, passScore, actualScore, status, memo, subjectId, officialExamId,
    organization, registrationStart, registrationEnd, resultDate, fee, location, url, year, session: examSession, description,
  } = body;

  if (!name || !examDate) return NextResponse.json({ error: "name and examDate are required" }, { status: 400 });

  const exam = await prisma.exam.create({
    data: {
      userId: session.user.id,
      name,
      category: category || null,
      examDate,
      targetScore: targetScore ? Number(targetScore) : null,
      passScore: passScore ? Number(passScore) : null,
      actualScore: actualScore ? Number(actualScore) : null,
      status: status ?? "upcoming",
      memo: memo || null,
      subjectId: subjectId || null,
      officialExamId: officialExamId || null,
      organization: organization || null,
      registrationStart: registrationStart || null,
      registrationEnd: registrationEnd || null,
      resultDate: resultDate || null,
      fee: fee ? Number(fee) : null,
      location: location || null,
      url: url || null,
      year: year ? Number(year) : null,
      session: examSession ? Number(examSession) : null,
      description: description || null,
    },
    include: { subject: { select: { id: true, name: true, emoji: true, color: true } } },
  });

  return NextResponse.json(exam, { status: 201 });
}
