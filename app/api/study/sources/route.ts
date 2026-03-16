import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");

  const sources = await prisma.studySource.findMany({
    where: { userId: session.user.id, ...(subjectId ? { subjectId } : {}) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subjectId, type, title, content } = body;

  if (!title || !content) return NextResponse.json({ error: "title, content required" }, { status: 400 });

  const source = await prisma.studySource.create({
    data: {
      userId: session.user.id,
      subjectId: subjectId || null,
      type: type ?? "text",
      title,
      content,
    },
  });

  return NextResponse.json(source, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const source = await prisma.studySource.findUnique({ where: { id: body.id } });
  if (!source || source.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.studySource.delete({ where: { id: body.id } });
  return NextResponse.json({ success: true });
}
