import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const myOnly = searchParams.get("my") === "1";
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 500);
  const skip = (page - 1) * limit;

  const sort = searchParams.get("sort") ?? "latest"; // latest | rating
  const minRating = parseFloat(searchParams.get("minRating") ?? "0");

  const where: Record<string, unknown> = {};
  where.userId = session.user.id; // 항상 본인 것만
  if (category) where.category = category;
  if (minRating > 0) where.avgRating = { gte: minRating };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { menus: { has: search } },
    ];
  }

  const orderBy = sort === "rating"
    ? [{ avgRating: "desc" as const }, { createdAt: "desc" as const }]
    : { createdAt: "desc" as const };

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true } },
        bookmarks: { where: { userId: session.user.id }, select: { id: true, listName: true } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.restaurant.count({ where }),
  ]);

  return NextResponse.json({ restaurants, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, category, address, roadAddress, latitude, longitude, phone, url, description, menus } = body;

  if (!name || !category || !address) {
    return NextResponse.json({ error: "이름, 카테고리, 주소는 필수입니다." }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      userId: session.user.id,
      name,
      category,
      address,
      roadAddress: roadAddress || null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      phone: phone || null,
      url: url || null,
      description: description || null,
      menus: menus ?? [],
      // 등록 즉시 내 맛집으로 자동 저장
      bookmarks: {
        create: { userId: session.user.id, listName: "내 맛집" },
      },
    },
  });

  return NextResponse.json(restaurant, { status: 201 });
}
