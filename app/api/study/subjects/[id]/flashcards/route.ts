import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const flashcards = await prisma.flashcard.findMany({
    where: { subjectId: id, userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(flashcards);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { front, back, tags } = body;

  if (!front || !back) return NextResponse.json({ error: "front and back are required" }, { status: 400 });

  const flashcard = await prisma.flashcard.create({
    data: {
      userId: session.user.id,
      subjectId: id,
      front,
      back,
      tags: tags ?? [],
    },
  });

  return NextResponse.json(flashcard, { status: 201 });
}
