import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await prisma.watchlistGroup.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, emoji, color, description } = body;

  if (!name) return NextResponse.json({ error: "이름은 필수입니다" }, { status: 400 });

  const group = await prisma.watchlistGroup.create({
    data: {
      userId: session.user.id,
      name,
      emoji: emoji || "📌",
      color: color || "blue",
      description: description || null,
    },
  });

  return NextResponse.json(group, { status: 201 });
}
