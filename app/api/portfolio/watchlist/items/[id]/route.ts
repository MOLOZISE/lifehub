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
  const item = await prisma.watchlistItem.findUnique({ where: { id } });
  if (!item || item.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { groupId, ticker, name, market, sector, currentPrice, targetPrice, currency, memo } = body;

  const updated = await prisma.watchlistItem.update({
    where: { id },
    data: {
      groupId: groupId || null,
      ticker,
      name,
      market,
      sector: sector || null,
      currentPrice: currentPrice != null ? Number(currentPrice) : undefined,
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      currency: currency || "KRW",
      memo: memo || null,
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
  const item = await prisma.watchlistItem.findUnique({ where: { id } });
  if (!item || item.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.watchlistItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
