import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { groupId, ticker, name, market, sector, currentPrice, targetPrice, currency, memo } = body;

  if (!ticker || !name || !market) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const item = await prisma.watchlistItem.create({
    data: {
      userId: session.user.id,
      groupId: groupId || null,
      ticker,
      name,
      market,
      sector: sector || null,
      currentPrice: currentPrice ? Number(currentPrice) : 0,
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      currency: currency || "KRW",
      memo: memo || null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
