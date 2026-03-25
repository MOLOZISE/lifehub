import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { restaurant: { select: { id: true, name: true, category: true, avgRating: true } } },
      },
    },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (course.userId !== session.user.id && !course.isPublic)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ course });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const course = await prisma.course.findUnique({ where: { id }, select: { userId: true } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (course.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description, theme, tags, isPublic } = await req.json();
  const updated = await prisma.course.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(theme !== undefined && { theme }),
      ...(tags !== undefined && { tags }),
      ...(isPublic !== undefined && { isPublic }),
    },
  });

  return NextResponse.json({ course: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const course = await prisma.course.findUnique({ where: { id }, select: { userId: true } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (course.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.course.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
