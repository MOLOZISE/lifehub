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
  const holding = await prisma.holding.findUnique({ where: { id } });
  if (!holding || holding.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { ticker, name, market, sector, quantity, avgPrice, currentPrice, currency, memo } = body;

  // 제공된 필드만 업데이트 (partial update)
  const data: Record<string, unknown> = {};
  if (ticker !== undefined) data.ticker = ticker;
  if (name !== undefined) data.name = name;
  if (market !== undefined) data.market = market;
  if (sector !== undefined) data.sector = sector || null;
  if (quantity !== undefined) data.quantity = Number(quantity);
  if (avgPrice !== undefined) data.avgPrice = Number(avgPrice);
  if (currentPrice !== undefined) data.currentPrice = Number(currentPrice);
  if (currency !== undefined) data.currency = currency;
  if (memo !== undefined) data.memo = memo || null;

  const updated = await prisma.holding.update({
    where: { id },
    data,
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
  const holding = await prisma.holding.findUnique({ where: { id } });
  if (!holding || holding.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.holding.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
