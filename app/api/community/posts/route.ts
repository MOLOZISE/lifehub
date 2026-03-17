import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/community/posts?category=free&page=1&limit=20
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") ?? "latest"; // latest | popular
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const where = {
    ...(category ? { category } : {}),
    ...(search ? {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { content: { contains: search, mode: "insensitive" as const } },
        { tags: { has: search } },
      ],
    } : {}),
  };

  const orderBy = sort === "popular"
    ? [{ likes: { _count: "desc" as const } }, { createdAt: "desc" as const }]
    : { createdAt: "desc" as const };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true, image: true } },
        _count: { select: { comments: true, likes: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  // 익명 게시글은 작성자 정보 숨김
  const sanitized = posts.map((post: typeof posts[number]) => ({
    ...post,
    user: post.isAnonymous ? null : post.user,
  }));

  return NextResponse.json({ posts: sanitized, total, page, limit });
}

// POST /api/community/posts
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { title, content, category, isAnonymous, tags, images } = await req.json();

  if (!title?.trim() || !content?.trim() || !category) {
    return NextResponse.json({ error: "제목, 내용, 카테고리는 필수입니다." }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      title: title.trim(),
      content: content.trim(),
      category,
      isAnonymous: isAnonymous ?? false,
      tags: tags ?? [],
      images: images ?? [],
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
      _count: { select: { comments: true, likes: true } },
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}
