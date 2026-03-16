import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const group = await prisma.watchlistGroup.findUnique({ where: { id } });
  if (!group || group.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, emoji, color, description } = body;

  const updated = await prisma.watchlistGroup.update({
    where: { id },
    data: {
      name,
      emoji: emoji || "📌",
      color: color || "blue",
      description: description || null,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const group = await prisma.watchlistGroup.findUnique({ where: { id } });
  if (!group || group.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascade delete items in this group
  await prisma.watchlistItem.deleteMany({ where: { groupId: id } });
  await prisma.watchlistGroup.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
