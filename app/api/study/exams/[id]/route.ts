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

  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam || exam.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    name, category, examDate, targetScore, passScore, actualScore, status, memo, subjectId, officialExamId,
    organization, registrationStart, registrationEnd, resultDate, fee, location, url, year, session: examSession, description,
  } = body;

  const updated = await prisma.exam.update({
    where: { id },
    data: {
      name: name ?? exam.name,
      category: category ?? exam.category,
      examDate: examDate ? examDate : exam.examDate,
      targetScore: targetScore !== undefined ? (targetScore ? Number(targetScore) : null) : exam.targetScore,
      passScore: passScore !== undefined ? (passScore ? Number(passScore) : null) : exam.passScore,
      actualScore: actualScore !== undefined ? (actualScore ? Number(actualScore) : null) : exam.actualScore,
      status: status ?? exam.status,
      memo: memo !== undefined ? (memo || null) : exam.memo,
      subjectId: subjectId !== undefined ? (subjectId || null) : exam.subjectId,
      officialExamId: officialExamId !== undefined ? (officialExamId || null) : exam.officialExamId,
      organization: organization !== undefined ? (organization || null) : exam.organization,
      registrationStart: registrationStart !== undefined ? (registrationStart || null) : exam.registrationStart,
      registrationEnd: registrationEnd !== undefined ? (registrationEnd || null) : exam.registrationEnd,
      resultDate: resultDate !== undefined ? (resultDate || null) : exam.resultDate,
      fee: fee !== undefined ? (fee ? Number(fee) : null) : exam.fee,
      location: location !== undefined ? (location || null) : exam.location,
      url: url !== undefined ? (url || null) : exam.url,
      year: year !== undefined ? (year ? Number(year) : null) : exam.year,
      session: examSession !== undefined ? (examSession ? Number(examSession) : null) : exam.session,
      description: description !== undefined ? (description || null) : exam.description,
    },
    include: { subject: { select: { id: true, name: true, emoji: true, color: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam || exam.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.exam.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
