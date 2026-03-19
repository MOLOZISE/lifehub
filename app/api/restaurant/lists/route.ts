import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/restaurant/lists - 내 리스트 목록 (아이템 수 포함)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lists = await prisma.restaurantList.findMany({
    where: { userId: session.user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(lists.map(l => ({
    id: l.id,
    name: l.name,
    emoji: l.emoji,
    color: l.color,
    sortOrder: l.sortOrder,
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

  // sortOrder: 현재 최대값 + 1
  const maxOrder = await prisma.restaurantList.aggregate({
    where: { userId: session.user.id },
    _max: { sortOrder: true },
  });

  const list = await prisma.restaurantList.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      emoji: emoji ?? "🍽️",
      color: color ?? "#6366f1",
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json(list, { status: 201 });
}
