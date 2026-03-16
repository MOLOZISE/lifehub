import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;
  const body = await req.json();
  const { title, content, tags, isPinned } = body;

  const result = await prisma.note.updateMany({
    where: { id: noteId, subjectId: id, userId: session.user.id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(tags !== undefined && { tags }),
      ...(isPinned !== undefined && { isPinned }),
    },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.note.findUnique({ where: { id: noteId } });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;

  const result = await prisma.note.deleteMany({
    where: { id: noteId, subjectId: id, userId: session.user.id },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
