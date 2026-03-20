import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/official-exams — 공개 공식 시험 목록 (로그인 불필요)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const year = searchParams.get("year");
  const q = searchParams.get("q");

  const exams = await prisma.officialExam.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
      ...(year ? { year: Number(year) } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ examDate: "asc" }],
  });

  return NextResponse.json(exams);
}

// POST /api/official-exams — 관리자 전용 생성
export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, organization, category, examDate, registrationStart, registrationEnd, resultDate, fee, location, description, url, year, session: examSession } = body;

  if (!name || !organization || !category || !examDate || !year) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const exam = await prisma.officialExam.create({
    data: {
      name, organization, category, examDate,
      registrationStart: registrationStart || null,
      registrationEnd: registrationEnd || null,
      resultDate: resultDate || null,
      fee: fee ? Number(fee) : null,
      location: location || null,
      description: description || null,
      url: url || null,
      year: Number(year),
      session: examSession ? Number(examSession) : null,
    },
  });

  return NextResponse.json(exam, { status: 201 });
}
