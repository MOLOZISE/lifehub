import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// gender는 DB 마이그레이션 후 추가 예정 (현재 Supabase에 컬럼 없음)
const SELECT = { id: true, name: true, email: true, username: true, bio: true, image: true, createdAt: true, role: true, birthDate: true, birthTime: true };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: SELECT });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, username, bio, birthDate, birthTime, gender } = body;

  if (username) {
    const existing = await prisma.user.findFirst({ where: { username, id: { not: session.user.id } } });
    if (existing) return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 409 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {
    name: name || undefined,
    username: username || undefined,
    bio: bio !== undefined ? bio : undefined,
    birthDate: birthDate !== undefined ? birthDate : undefined,
    birthTime: birthTime !== undefined ? birthTime : undefined,
    // gender: gender !== undefined ? gender : undefined, // DB 마이그레이션 후 주석 해제
  };

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: SELECT,
  });

  return NextResponse.json(updated);
}
