import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET - 팔로우 여부 확인
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ following: false });
  const { userId } = await params;

  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
  });
  return NextResponse.json({ following: !!follow });
}

// POST - 팔로우 토글
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await params;

  if (userId === session.user.id) return NextResponse.json({ error: "Can't follow yourself" }, { status: 400 });

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
  });

  if (existing) {
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
    });
    return NextResponse.json({ following: false });
  } else {
    await prisma.follow.create({
      data: { followerId: session.user.id, followingId: userId },
    });
    return NextResponse.json({ following: true });
  }
}
