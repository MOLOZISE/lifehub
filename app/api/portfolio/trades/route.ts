import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trades = await prisma.stockTrade.findMany({
    where: { userId: session.user.id },
    orderBy: { tradedAt: "desc" },
  });

  return NextResponse.json(trades);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ticker, name, market, type, quantity, price, fee, currency, memo, tradedAt } = body;

  if (!ticker || !name || !market || !type || !quantity || !price || !currency || !tradedAt) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const trade = await prisma.stockTrade.create({
    data: {
      userId: session.user.id,
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

  return NextResponse.json(trade, { status: 201 });
}
