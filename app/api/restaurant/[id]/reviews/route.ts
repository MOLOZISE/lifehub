import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: restaurantId } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { rating, content, visitedAt, isAnonymous } = body;

  if (!rating || !content) {
    return NextResponse.json({ error: "별점과 내용은 필수입니다." }, { status: 400 });
  }

  const review = await prisma.restaurantReview.create({
    data: {
      userId: session.user.id,
      restaurantId,
      rating: Number(rating),
      content,
      visitedAt: visitedAt || null,
      isAnonymous: Boolean(isAnonymous),
    },
  });

  // Recalculate avgRating
  const agg = await prisma.restaurantReview.aggregate({
    where: { restaurantId },
    _avg: { rating: true },
    _count: { id: true },
  });

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count.id,
    },
  });

  return NextResponse.json(review, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: restaurantId } = await params;
  const { reviewId } = await req.json();

  const review = await prisma.restaurantReview.findUnique({ where: { id: reviewId } });
  if (!review || review.userId !== session.user.id || review.restaurantId !== restaurantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.restaurantReview.delete({ where: { id: reviewId } });

  const agg = await prisma.restaurantReview.aggregate({
    where: { restaurantId },
    _avg: { rating: true },
    _count: { id: true },
  });

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count.id,
    },
  });

  return NextResponse.json({ success: true });
}
