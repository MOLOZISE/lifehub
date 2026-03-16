import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// POST /api/community/posts/[id]/like — 토글
export async function POST(_req: NextRequest, { params }: Params) {
  const { id: postId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId: session.user.id, postId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { userId_postId: { userId: session.user.id, postId } } });
    const count = await prisma.like.count({ where: { postId } });
    return NextResponse.json({ liked: false, count });
  } else {
    await prisma.like.create({ data: { userId: session.user.id, postId } });
    const count = await prisma.like.count({ where: { postId } });
    return NextResponse.json({ liked: true, count });
  }
}
