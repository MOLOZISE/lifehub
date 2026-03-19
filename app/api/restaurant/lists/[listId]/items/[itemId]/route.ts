import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ listId: string; itemId: string }> };

// PATCH /api/restaurant/lists/[listId]/items/[itemId] - 메모 수정
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId, itemId } = await params;

  const list = await prisma.restaurantList.findUnique({ where: { id: listId } });
  if (!list || list.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { memo } = await req.json();

  const updated = await prisma.restaurantListItem.update({
    where: { id: itemId },
    data: { memo: memo || null },
  });

  return NextResponse.json(updated);
}
