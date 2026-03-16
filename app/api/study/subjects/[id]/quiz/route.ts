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

  const questions = await prisma.quizQuestion.findMany({
    where: { subjectId: id, userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(questions);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { question, type, options, answer, explanation, tags } = body;

  if (!question || !answer) return NextResponse.json({ error: "question and answer are required" }, { status: 400 });

  const quizQuestion = await prisma.quizQuestion.create({
    data: {
      userId: session.user.id,
      subjectId: id,
      question,
      type: type ?? "multiple",
      options: options ?? [],
      answer,
      explanation: explanation ?? "",
      tags: tags ?? [],
    },
  });

  return NextResponse.json(quizQuestion, { status: 201 });
}
