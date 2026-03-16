import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, cardId } = await params;
  const body = await req.json();
  const { front, back, tags, interval, easeFactor, nextReviewAt, lastReviewAt, reviewCount, known } = body;

  const result = await prisma.flashcard.updateMany({
    where: { id: cardId, subjectId: id, userId: session.user.id },
    data: {
      ...(front !== undefined && { front }),
      ...(back !== undefined && { back }),
      ...(tags !== undefined && { tags }),
      ...(interval !== undefined && { interval }),
      ...(easeFactor !== undefined && { easeFactor }),
      ...(nextReviewAt !== undefined && { nextReviewAt: new Date(nextReviewAt) }),
      ...(lastReviewAt !== undefined && { lastReviewAt: new Date(lastReviewAt) }),
      ...(reviewCount !== undefined && { reviewCount }),
      ...(known !== undefined && { known }),
    },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.flashcard.findUnique({ where: { id: cardId } });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, cardId } = await params;

  const result = await prisma.flashcard.deleteMany({
    where: { id: cardId, subjectId: id, userId: session.user.id },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
