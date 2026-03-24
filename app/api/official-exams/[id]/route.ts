import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function checkAdmin() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  return user?.id && user?.role === "ADMIN" ? user.id : null;
}

// PATCH /api/official-exams/[id] — 관리자 수정
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const exam = await prisma.officialExam.update({
    where: { id },
    data: {
      name: body.name,
      organization: body.organization,
      category: body.category,
      examDate: body.examDate,
      registrationStart: body.registrationStart || null,
      registrationEnd: body.registrationEnd || null,
      resultDate: body.resultDate || null,
      fee: body.fee ? Number(body.fee) : null,
      location: body.location || null,
      description: body.description || null,
      url: body.url || null,
      year: Number(body.year),
      session: body.session ? Number(body.session) : null,
      isActive: body.isActive ?? true,
      examTypeId: body.examTypeId || null,
    },
  });

  return NextResponse.json(exam);
}

// DELETE /api/official-exams/[id] — 관리자 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.officialExam.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
