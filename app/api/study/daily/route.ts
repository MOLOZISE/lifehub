import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const today = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const goal = await prisma.dailyGoal.findFirst({
    where: { userId: session.user.id, date: today },
    include: { goals: true },
  });

  const logs = await prisma.studyLog.findMany({
    where: { userId: session.user.id, date: today },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ goal, logs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, goals } = body;

  const today = date ?? new Date().toISOString().slice(0, 10);

  const existing = await prisma.dailyGoal.findFirst({
    where: { userId: session.user.id, date: today },
  });

  if (existing) {
    await prisma.dailyGoalItem.deleteMany({ where: { dailyGoalId: existing.id } });
    const updated = await prisma.dailyGoal.update({
      where: { id: existing.id },
      data: {
        goals: {
          create: (goals ?? []).map((item: { subjectId: string; targetMinutes: number; done?: boolean }) => ({
            subjectId: item.subjectId,
            targetMinutes: Number(item.targetMinutes),
            done: item.done ?? false,
          })),
        },
      },
      include: { goals: true },
    });
    return NextResponse.json(updated);
  }

  const goal = await prisma.dailyGoal.create({
    data: {
      userId: session.user.id,
      date: today,
      goals: {
        create: (goals ?? []).map((item: { subjectId: string; targetMinutes: number; done?: boolean }) => ({
          subjectId: item.subjectId,
          targetMinutes: Number(item.targetMinutes),
          done: item.done ?? false,
        })),
      },
    },
    include: { goals: true },
  });

  return NextResponse.json(goal, { status: 201 });
}
