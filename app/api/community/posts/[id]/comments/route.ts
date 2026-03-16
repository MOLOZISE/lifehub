import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// POST /api/community/posts/[id]/comments
export async function POST(req: NextRequest, { params }: Params) {
  const { id: postId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { content, isAnonymous, parentId } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });

  const comment = await prisma.comment.create({
    data: {
      userId: session.user.id,
      postId,
      content: content.trim(),
      isAnonymous: isAnonymous ?? false,
      parentId: parentId ?? null,
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({
    comment: {
      ...comment,
      user: comment.isAnonymous ? null : comment.user,
    },
  }, { status: 201 });
}
