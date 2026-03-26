import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, itemId } = await params;

  const item = await prisma.courseItem.findUnique({
    where: { id: itemId },
    include: { course: { select: { userId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.courseId !== id || item.course.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updated = await prisma.courseItem.update({
    where: { id: itemId },
    data: {
      ...(body.order !== undefined && { order: Number(body.order) }),
      ...(body.day !== undefined && { day: Math.max(1, Number(body.day)) }),
      ...(body.placeName !== undefined && { placeName: body.placeName }),
      ...(body.placeAddress !== undefined && { placeAddress: body.placeAddress }),
      ...(body.lat !== undefined && { lat: body.lat }),
      ...(body.lng !== undefined && { lng: body.lng }),
      ...(body.plannedTime !== undefined && { plannedTime: body.plannedTime || null }),
      ...(body.duration !== undefined && { duration: body.duration ? Number(body.duration) : null }),
      ...(body.note !== undefined && { note: body.note?.trim() || null }),
      ...(body.kakaoPlaceId !== undefined && { kakaoPlaceId: body.kakaoPlaceId || null }),
    },
  });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, itemId } = await params;

  const item = await prisma.courseItem.findUnique({
    where: { id: itemId },
    include: { course: { select: { userId: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.courseId !== id || item.course.userId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.courseItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
