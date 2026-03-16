import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, sourceId } = await params;

  const result = await prisma.studySource.deleteMany({
    where: { id: sourceId, subjectId: id, userId: session.user.id },
  });

  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
