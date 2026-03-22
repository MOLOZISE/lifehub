import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // "2026-03"

  const where: { userId: string; date?: { startsWith: string } } = { userId: session.user.id };
  if (month) where.date = { startsWith: month };

  const events = await prisma.calendarEvent.findMany({ where, orderBy: { date: "asc" } });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const event = await prisma.calendarEvent.create({
    data: { ...body, userId: session.user.id },
  });
  return NextResponse.json(event);
}
