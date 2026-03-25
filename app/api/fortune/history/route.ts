import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM, optional

  const where = month
    ? { userId: session.user.id, date: { gte: `${month}-01`, lte: `${month}-31` } }
    : { userId: session.user.id };

  const records = await prisma.fortuneCache.findMany({
    where,
    select: { id: true, type: true, date: true, content: true, createdAt: true },
    orderBy: { date: "desc" },
    take: 100,
  });

  // 날짜별 그룹핑 (같은 날 여러 타입 가능)
  const grouped: Record<string, typeof records> = {};
  for (const r of records) {
    (grouped[r.date] ??= []).push(r);
  }

  return NextResponse.json({ grouped, total: records.length });
}
