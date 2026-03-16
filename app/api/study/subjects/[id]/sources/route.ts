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

  const sources = await prisma.studySource.findMany({
    where: { subjectId: id, userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sources);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title, content, type } = body;

  if (!title || !content) return NextResponse.json({ error: "title and content are required" }, { status: 400 });

  const source = await prisma.studySource.create({
    data: {
      userId: session.user.id,
      subjectId: id,
      title,
      content,
      type: type ?? "text",
    },
  });

  return NextResponse.json(source, { status: 201 });
}
