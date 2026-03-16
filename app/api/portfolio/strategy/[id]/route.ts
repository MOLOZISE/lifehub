import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const memo = await prisma.strategyMemo.findUnique({ where: { id } });
  if (!memo || memo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { ticker, title, content } = body;

  const updated = await prisma.strategyMemo.update({
    where: { id },
    data: {
      ticker: ticker ?? memo.ticker,
      title: title ?? memo.title,
      content: content ?? memo.content,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const memo = await prisma.strategyMemo.findUnique({ where: { id } });
  if (!memo || memo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.strategyMemo.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
