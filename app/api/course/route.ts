import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function cuid() {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { items: true } },
      items: { select: { day: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ courses: courses.map(c => {
    // day별 장소 수 집계
    const daySummaryMap = new Map<number, number>();
    for (const it of c.items) {
      daySummaryMap.set(it.day, (daySummaryMap.get(it.day) ?? 0) + 1);
    }
    const daySummary = Array.from({ length: c.totalDays }, (_, i) => ({
      day: i + 1,
      count: daySummaryMap.get(i + 1) ?? 0,
    }));
    return {
      id: c.id, title: c.title, description: c.description,
      theme: c.theme, tags: c.tags, isPublic: c.isPublic,
      totalDays: c.totalDays, daySummary,
      itemCount: c._count.items, createdAt: c.createdAt, updatedAt: c.updatedAt,
    };
  }) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, theme = "date", tags = [], isPublic = false, totalDays = 1 } = body;
  if (!title?.trim()) return NextResponse.json({ error: "제목을 입력해주세요" }, { status: 400 });

  const course = await prisma.course.create({
    data: {
      id: cuid(),
      userId: session.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      theme,
      tags: Array.isArray(tags) ? tags : [],
      isPublic,
      totalDays: Math.max(1, Math.min(30, Number(totalDays))),
    },
  });

  return NextResponse.json({ course }, { status: 201 });
}
