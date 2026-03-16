import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// GET /api/community/posts/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, image: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, image: true } },
          replies: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
        },
        where: { parentId: null }, // 최상위 댓글만 (대댓글은 replies에 포함)
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

  // 조회수 증가
  await prisma.post.update({ where: { id }, data: { viewCount: { increment: 1 } } });

  // 익명 처리
  const sanitized = {
    ...post,
    user: post.isAnonymous ? null : post.user,
    comments: post.comments.map((c: typeof post.comments[number]) => ({
      ...c,
      user: c.isAnonymous ? null : c.user,
      replies: c.replies.map((r: typeof c.replies[number]) => ({
        ...r,
        user: r.isAnonymous ? null : r.user,
      })),
    })),
  };

  // 내가 좋아요 눌렀는지
  let isLiked = false;
  if (session?.user?.id) {
    const like = await prisma.like.findUnique({
      where: { userId_postId: { userId: session.user.id, postId: id } },
    });
    isLiked = !!like;
  }

  return NextResponse.json({ post: sanitized, isLiked });
}

// PUT /api/community/posts/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (post.userId !== session.user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { title, content, tags, images } = await req.json();
  const updated = await prisma.post.update({
    where: { id },
    data: { title, content, tags, images },
  });

  return NextResponse.json({ post: updated });
}

// DELETE /api/community/posts/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (post.userId !== session.user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
