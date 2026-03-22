import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "week";
  const period = searchParams.get("period");

  if (period) {
    const plan = await prisma.plan.findUnique({ where: { userId_type_period: { userId: session.user.id, type, period } } });
    return NextResponse.json({ plan });
  }

  const plans = await prisma.plan.findMany({
    where: { userId: session.user.id, type },
    orderBy: { period: "desc" },
    take: 12,
  });
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, period, goals, reflection } = await req.json();
  const plan = await prisma.plan.upsert({
    where: { userId_type_period: { userId: session.user.id, type, period } },
    create: { userId: session.user.id, type, period, goals: goals ?? [], reflection },
    update: { goals: goals ?? [], reflection },
  });
  return NextResponse.json(plan);
}
