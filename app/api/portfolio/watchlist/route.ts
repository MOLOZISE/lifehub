import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await prisma.watchlistGroup.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const ungroupedItems = await prisma.watchlistItem.findMany({
    where: { userId: session.user.id, groupId: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ groups, ungroupedItems });
}
