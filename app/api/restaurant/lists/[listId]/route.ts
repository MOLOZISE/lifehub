import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ listId: string }> };

// PATCH /api/restaurant/lists/[listId] - 리스트 수정 (이름/이모지/색상)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await params;
  const { name, emoji, color, sortOrder } = await req.json();

  const list = await prisma.restaurantList.findUnique({ where: { id: listId } });
  if (!list || list.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.restaurantList.update({
    where: { id: listId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(emoji !== undefined && { emoji }),
      ...(color !== undefined && { color }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/restaurant/lists/[listId] - 리스트 삭제 (아이템도 cascade)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await params;

  const list = await prisma.restaurantList.findUnique({ where: { id: listId } });
  if (!list || list.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.restaurantList.delete({ where: { id: listId } });
  return NextResponse.json({ ok: true });
}
