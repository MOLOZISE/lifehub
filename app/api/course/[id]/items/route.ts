import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function cuid() {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

type Params = { params: Promise<{ id: string }> };

async function ownerCheck(courseId: string, userId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { userId: true } });
  if (!course) return "not_found";
  if (course.userId !== userId) return "forbidden";
  return "ok";
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const check = await ownerCheck(id, session.user.id);
  if (check === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (check === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.courseItem.findMany({
    where: { courseId: id },
    orderBy: { order: "asc" },
    include: { restaurant: { select: { id: true, name: true, category: true, avgRating: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const check = await ownerCheck(id, session.user.id);
  if (check === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (check === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { restaurantId, placeName, placeAddress, lat, lng, plannedTime, duration, note } = body;
  if (!placeName?.trim()) return NextResponse.json({ error: "장소명을 입력해주세요" }, { status: 400 });
  if (!placeAddress?.trim()) return NextResponse.json({ error: "주소를 입력해주세요" }, { status: 400 });

  const maxOrderItem = await prisma.courseItem.findFirst({
    where: { courseId: id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (maxOrderItem?.order ?? -1) + 1;

  const item = await prisma.courseItem.create({
    data: {
      id: cuid(),
      courseId: id,
      order: nextOrder,
      restaurantId: restaurantId || null,
      placeName: placeName.trim(),
      placeAddress: placeAddress.trim(),
      lat: lat ?? null,
      lng: lng ?? null,
      plannedTime: plannedTime || null,
      duration: duration ? Number(duration) : null,
      note: note?.trim() || null,
    },
    include: { restaurant: { select: { id: true, name: true, category: true, avgRating: true } } },
  });

  return NextResponse.json({ item }, { status: 201 });
}
