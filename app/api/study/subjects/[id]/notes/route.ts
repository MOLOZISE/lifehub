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

  const notes = await prisma.note.findMany({
    where: { subjectId: id, userId: session.user.id },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(notes);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title, content, tags, isPinned } = body;

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const note = await prisma.note.create({
    data: {
      userId: session.user.id,
      subjectId: id,
      title,
      content: content ?? "",
      tags: tags ?? [],
      isPinned: isPinned ?? false,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
