import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") return null;
  return session;
}

// GET /api/admin/exam-types — 시험 종류 목록
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const examTypes = await prisma.examType.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { officialExams: true, sharedResources: true } },
    },
  });

  return NextResponse.json(examTypes);
}

// POST /api/admin/exam-types — 시험 종류 생성
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, category, organization, description } = await req.json();
  if (!name || !category) {
    return NextResponse.json({ error: "name, category 필수" }, { status: 400 });
  }

  const examType = await prisma.examType.create({
    data: {
      name: name.trim(),
      category,
      organization: organization?.trim() || null,
      description: description?.trim() || null,
    },
  });

  return NextResponse.json(examType, { status: 201 });
}
