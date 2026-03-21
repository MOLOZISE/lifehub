import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const holdings = await prisma.holding.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(holdings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ticker, name, market, sector, quantity, avgPrice, currentPrice, currency, memo } = body;

  if (!ticker || !name || !market || quantity == null || avgPrice == null || currentPrice == null || !currency) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const holding = await prisma.holding.create({
    data: {
      userId: session.user.id,
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

  return NextResponse.json(holding, { status: 201 });
}
