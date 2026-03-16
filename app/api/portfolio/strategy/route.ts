import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");

  if (ticker) {
    const memo = await prisma.strategyMemo.findFirst({
      where: { userId: session.user.id, ticker },
    });
    return NextResponse.json(memo ?? null);
  }

  const memos = await prisma.strategyMemo.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(memos);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ticker, content, title } = body;

  if (!ticker || !content) {
    return NextResponse.json({ error: "ticker와 content는 필수입니다" }, { status: 400 });
  }

  const existing = await prisma.strategyMemo.findFirst({
    where: { userId: session.user.id, ticker },
  });

  if (existing) {
    const updated = await prisma.strategyMemo.update({
      where: { id: existing.id },
      data: { content, title: title || existing.title },
    });
    return NextResponse.json(updated);
  }

  const memo = await prisma.strategyMemo.create({
    data: {
      userId: session.user.id,
      ticker,
      title: title || ticker,
      content,
    },
  });

  return NextResponse.json(memo, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ticker } = body;

  if (!ticker) return NextResponse.json({ error: "ticker는 필수입니다" }, { status: 400 });

  await prisma.strategyMemo.deleteMany({
    where: { userId: session.user.id, ticker },
  });

  return NextResponse.json({ success: true });
}
