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

  const updated = await prisma.holding.update({
    where: { id },
    data: {
      ticker,
      name,
      market,
      sector: sector || null,
      quantity: Number(quantity),
      avgPrice: Number(avgPrice),
      currentPrice: Number(currentPrice),
      currency,
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
  const holding = await prisma.holding.findUnique({ where: { id } });
  if (!holding || holding.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.holding.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
