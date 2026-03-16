import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: restaurantId } = await params;
  const { listName } = await req.json();

  const existing = await prisma.restaurantBookmark.findUnique({
    where: { userId_restaurantId: { userId: session.user.id, restaurantId } },
  });

  if (existing) {
    // Update list if different, else remove (toggle)
    if (existing.listName === listName) {
      await prisma.restaurantBookmark.delete({ where: { id: existing.id } });
      return NextResponse.json({ bookmarked: false });
    } else {
      const updated = await prisma.restaurantBookmark.update({
        where: { id: existing.id },
        data: { listName },
      });
      return NextResponse.json({ bookmarked: true, listName: updated.listName });
    }
  }

  const bookmark = await prisma.restaurantBookmark.create({
    data: {
      userId: session.user.id,
      restaurantId,
      listName: listName ?? "가고 싶은 곳",
    },
  });

  return NextResponse.json({ bookmarked: true, listName: bookmark.listName }, { status: 201 });
}
