import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const date = searchParams.get("date");

  if (date) {
    const entry = await prisma.diaryEntry.findUnique({ where: { userId_date: { userId: session.user.id, date } } });
    return NextResponse.json({ entry });
  }

  const entries = await prisma.diaryEntry.findMany({
    where: { userId: session.user.id, ...(month ? { date: { startsWith: month } } : {}) },
    orderBy: { date: "desc" },
    select: { id: true, date: true, mood: true, tags: true, content: true, createdAt: true },
  });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { date, content, mood, tags } = await req.json();
  const entry = await prisma.diaryEntry.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: { userId: session.user.id, date, content, mood, tags: tags ?? [] },
    update: { content, mood, tags: tags ?? [] },
  });
  return NextResponse.json(entry);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  await prisma.diaryEntry.deleteMany({ where: { userId: session.user.id, date } });
  return NextResponse.json({ ok: true });
}
