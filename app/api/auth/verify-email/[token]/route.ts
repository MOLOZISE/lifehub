import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record) {
    return NextResponse.redirect(new URL("/auth/verify-email?error=invalid", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.redirect(new URL("/auth/verify-email?error=expired", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }

  // 이메일 인증 완료
  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.redirect(new URL("/auth/verify-email?success=1", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
}
