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
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ courses: courses.map(c => ({
    id: c.id, title: c.title, description: c.description,
    theme: c.theme, tags: c.tags, isPublic: c.isPublic,
    itemCount: c._count.items, createdAt: c.createdAt, updatedAt: c.updatedAt,
  })) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, theme = "date", tags = [], isPublic = false } = body;
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
    },
  });

  return NextResponse.json({ course }, { status: 201 });
}
