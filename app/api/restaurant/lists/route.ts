import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/restaurant/lists - 내 리스트 목록 (없으면 기본 리스트 자동 생성)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let lists = await prisma.restaurantList.findMany({
    where: { userId: session.user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { items: true } } },
  });

  // 기본 "내 맛집" 리스트가 없으면 자동 생성
  const hasDefault = lists.some(l => l.isDefault);
  if (!hasDefault) {
    const defaultList = await prisma.restaurantList.create({
      data: {
        userId: session.user.id,
        name: "내 맛집",
        emoji: "🍽️",
        color: "#6366f1",
        sortOrder: 0,
        isDefault: true,
      },
      include: { _count: { select: { items: true } } },
    });
    lists = [defaultList, ...lists];
  }

  return NextResponse.json(lists.map(l => ({
    id: l.id,
    name: l.name,
    emoji: l.emoji,
    color: l.color,
    sortOrder: l.sortOrder,
    isDefault: l.isDefault,
    itemCount: l._count.items,
    createdAt: l.createdAt,
  })));
}

// POST /api/restaurant/lists - 리스트 생성
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, emoji, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const maxOrder = await prisma.restaurantList.aggregate({
    where: { userId: session.user.id },
    _max: { sortOrder: true },
  });

  const list = await prisma.restaurantList.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      emoji: emoji ?? "📌",
      color: color ?? "#6366f1",
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      isDefault: false,
    },
  });

  return NextResponse.json(list, { status: 201 });
}
