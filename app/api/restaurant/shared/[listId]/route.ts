import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ listId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { listId } = await params;

  const list = await prisma.restaurantList.findUnique({
    where: { id: listId },
    include: {
      user: { select: { name: true } },
      items: {
        orderBy: { addedAt: "desc" },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              category: true,
              address: true,
              latitude: true,
              longitude: true,
              avgRating: true,
              reviewCount: true,
              phone: true,
              url: true,
              description: true,
            },
          },
        },
      },
    },
  });

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: list.id,
    name: list.name,
    emoji: list.emoji,
    color: list.color,
    ownerName: list.user.name,
    itemCount: list.items.length,
    items: list.items.map((item) => ({
      id: item.id,
      memo: item.memo,
      addedAt: item.addedAt,
      restaurant: item.restaurant,
    })),
  });
}
