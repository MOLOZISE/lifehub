import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, username: true, bio: true, image: true, createdAt: true, role: true, birthDate: true, birthTime: true },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, username, bio, birthDate, birthTime } = body;

  // Check username uniqueness
  if (username) {
    const existing = await prisma.user.findFirst({
      where: { username, id: { not: session.user.id } },
    });
    if (existing) return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: name || undefined,
      username: username || undefined,
      bio: bio !== undefined ? bio : undefined,
      birthDate: birthDate !== undefined ? birthDate : undefined,
      birthTime: birthTime !== undefined ? birthTime : undefined,
    },
    select: { id: true, name: true, email: true, username: true, bio: true, image: true, birthDate: true, birthTime: true },
  });

  return NextResponse.json(updated);
}
