import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ listId: string }> };

// PATCH /api/restaurant/lists/[listId] - 리스트 수정
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

// DELETE /api/restaurant/lists/[listId] - 리스트 삭제 (기본 리스트 삭제 불가)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await params;

  const list = await prisma.restaurantList.findUnique({ where: { id: listId } });
  if (!list || list.userId !== session.user.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (list.isDefault)
    return NextResponse.json({ error: "기본 리스트는 삭제할 수 없습니다." }, { status: 400 });

  await prisma.restaurantList.delete({ where: { id: listId } });
  return NextResponse.json({ ok: true });
}
