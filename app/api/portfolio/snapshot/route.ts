import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "30");

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: {
      userId: session.user.id,
      date: { gte: sinceStr },
    },
    orderBy: { date: "asc" },
    select: { date: true, totalValue: true, totalCost: true },
  });

  return NextResponse.json(snapshots);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { totalValue, totalCost } = await req.json();
  if (typeof totalValue !== "number" || typeof totalCost !== "number") {
    return NextResponse.json({ error: "totalValue, totalCost are required numbers" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const snapshot = await prisma.portfolioSnapshot.upsert({
    where: { userId_date: { userId: session.user.id, date: today } },
    create: { userId: session.user.id, date: today, totalValue, totalCost },
    update: { totalValue, totalCost },
  });

  return NextResponse.json(snapshot);
}
