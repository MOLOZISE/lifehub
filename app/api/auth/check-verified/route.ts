import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({});

  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true, accounts: { where: { provider: "credentials" }, select: { id: true } } },
  });

  // credentials 계정이면서 미인증인 경우
  if (user && !user.emailVerified && user.accounts.length > 0) {
    return NextResponse.json({ unverified: true });
  }

  return NextResponse.json({ unverified: false });
}
