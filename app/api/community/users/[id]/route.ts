import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, image: true, username: true, bio: true, createdAt: true,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 현재 사용자가 팔로우 중인지 확인
  let isFollowing = false;
  if (session?.user?.id && session.user.id !== id) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: id } },
    });
    isFollowing = !!follow;
  }

  // 최근 게시글
  const posts = await prisma.post.findMany({
    where: { userId: id, isAnonymous: false },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true, title: true, category: true, createdAt: true,
      _count: { select: { likes: true, comments: true } },
      viewCount: true,
    },
  });

  return NextResponse.json({ ...user, isFollowing, posts });
}
