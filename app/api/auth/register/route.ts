import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "모든 필드를 입력해주세요." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        // password는 별도 Account 레코드로 저장 (NextAuth credentials 패턴)
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: email,
            access_token: hashedPassword, // 해시된 비밀번호 저장
          },
        },
      },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[register]", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
