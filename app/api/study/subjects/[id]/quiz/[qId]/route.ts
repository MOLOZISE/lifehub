import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; qId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, qId } = await params;
  const body = await req.json();
  const { question, type, options, answer, explanation, tags, wrongCount, lastAnsweredAt } = body;

  const result = await prisma.quizQuestion.updateMany({
    where: { id: qId, subjectId: id, userId: session.user.id },
    data: {
      ...(question !== undefined && { question }),
      ...(type !== undefined && { type }),
      ...(options !== undefined && { options }),
      ...(answer !== undefined && { answer }),
      ...(explanation !== undefined && { explanation }),
      ...(tags !== undefined && { tags }),
      ...(wrongCount !== undefined && { wrongCount }),
      ...(lastAnsweredAt !== undefined && { lastAnsweredAt: new Date(lastAnsweredAt) }),
    },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.quizQuestion.findUnique({ where: { id: qId } });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; qId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, qId } = await params;

  const result = await prisma.quizQuestion.deleteMany({
    where: { id: qId, subjectId: id, userId: session.user.id },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
