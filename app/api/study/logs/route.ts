import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const limit = Number(searchParams.get("limit") ?? 500);

  const where: Record<string, unknown> = { userId: session.user.id };
  if (startDate || endDate) {
    const dateFilter: Record<string, string> = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;
    where.date = dateFilter;
  }

  const logs = await prisma.studyLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { activityType, durationMinutes, subjectId, date } = body;

  if (!activityType || !durationMinutes || !date || !subjectId) return NextResponse.json({ error: "activityType, durationMinutes, date, subjectId required" }, { status: 400 });

  const log = await prisma.studyLog.create({
    data: {
      userId: session.user.id,
      activityType,
      durationMinutes: Number(durationMinutes),
      subjectId,
      date,
    },
  });

  return NextResponse.json(log, { status: 201 });
}
