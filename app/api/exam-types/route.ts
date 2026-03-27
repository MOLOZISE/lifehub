import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/exam-types — 활성화된 시험 종류 목록 (인증 유저 공개)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examTypes = await prisma.examType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ examTypes });
}
