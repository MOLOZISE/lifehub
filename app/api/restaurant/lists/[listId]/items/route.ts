import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ listId: string }> };

// GET /api/restaurant/lists/[listId]/items - 리스트 내 맛집 목록
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await params;

  const list = await prisma.restaurantList.findUnique({ where: { id: listId } });
  if (!list || list.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.restaurantListItem.findMany({
      where: { listId },
      skip,
      take: limit,
      orderBy: { addedAt: "desc" },
      include: {
        restaurant: {
          include: {
            _count: { select: { reviews: true } },
          },
        },
      },
    }),
    prisma.restaurantListItem.count({ where: { listId } }),
  ]);

  return NextResponse.json({
    items: items.map(item => ({
      id: item.id,
      memo: item.memo,
      addedAt: item.addedAt,
      restaurant: {
        id: item.restaurant.id,
        name: item.restaurant.name,
        category: item.restaurant.category,
        address: item.restaurant.address,
        latitude: item.restaurant.latitude,
        longitude: item.restaurant.longitude,
        avgRating: item.restaurant.avgRating,
        reviewCount: item.restaurant._count.reviews,
        url: item.restaurant.url,
      },
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

// POST /api/restaurant/lists/[listId]/items - 맛집 추가 (toggle)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await params;
  const { restaurantId, memo } = await req.json();

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const list = await prisma.restaurantList.findUnique({ where: { id: listId } });
  if (!list || list.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 이미 있으면 제거 (toggle)
  const existing = await prisma.restaurantListItem.findUnique({
    where: { listId_restaurantId: { listId, restaurantId } },
  });

  if (existing) {
    await prisma.restaurantListItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ added: false });
  }

  await prisma.restaurantListItem.create({
    data: { listId, restaurantId, userId: session.user.id, memo },
  });

  return NextResponse.json({ added: true }, { status: 201 });
}
