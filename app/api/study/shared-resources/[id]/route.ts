import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/study/shared-resources/[id] — 본인 자료만 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;
  const role = (session.user as { role?: string }).role;

  const resource = await prisma.sharedResource.findUnique({ where: { id } });
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 본인 또는 관리자만 삭제 가능
  if (resource.userId !== userId && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.sharedResource.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
