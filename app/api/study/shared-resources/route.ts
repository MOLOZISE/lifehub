import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/study/shared-resources?examTypeId=xxx — 공유 자료 목록 (로그인 필요)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examTypeId = req.nextUrl.searchParams.get("examTypeId");
  if (!examTypeId) return NextResponse.json({ error: "examTypeId required" }, { status: 400 });

  const resources = await prisma.sharedResource.findMany({
    where: { examTypeId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, image: true, username: true } },
    },
  });

  return NextResponse.json(resources);
}

// POST /api/study/shared-resources — 자료 공유 등록
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { examTypeId, title, url, description, type } = await req.json();

  if (!examTypeId || !title || !type) {
    return NextResponse.json({ error: "examTypeId, title, type 필수" }, { status: 400 });
  }

  // 공식 등록된 시험 종류만 허용
  const examType = await prisma.examType.findUnique({
    where: { id: examTypeId, isActive: true },
  });
  if (!examType) {
    return NextResponse.json({ error: "등록되지 않은 시험 종류입니다." }, { status: 400 });
  }

  const resource = await prisma.sharedResource.create({
    data: {
      userId: session.user.id,
      examTypeId,
      title: title.trim(),
      url: url?.trim() || null,
      description: description?.trim() || null,
      type,
    },
    include: {
      user: { select: { id: true, name: true, image: true, username: true } },
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
