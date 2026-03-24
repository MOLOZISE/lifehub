import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") return null;
  return session;
}

// PATCH /api/admin/exam-types/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, category, organization, description, isActive } = await req.json();

  const updated = await prisma.examType.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(category !== undefined && { category }),
      ...(organization !== undefined && { organization: organization?.trim() || null }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/admin/exam-types/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  await prisma.examType.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
