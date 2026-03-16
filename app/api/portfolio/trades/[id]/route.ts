import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const trade = await prisma.stockTrade.findUnique({ where: { id } });
  if (!trade || trade.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.stockTrade.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const trade = await prisma.stockTrade.findUnique({ where: { id } });
  if (!trade || trade.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { ticker, name, market, type, quantity, price, fee, currency, memo, tradedAt } = body;

  const updated = await prisma.stockTrade.update({
    where: { id },
    data: {
      ticker,
      name,
      market,
      type,
      quantity: Number(quantity),
      price: Number(price),
      fee: Number(fee ?? 0),
      currency,
      memo: memo || null,
      tradedAt: new Date(tradedAt),
    },
  });

  return NextResponse.json(updated);
}
