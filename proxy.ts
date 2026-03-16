import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge 런타임 호환 — Prisma 없이 JWT만 검증 (Next.js 16 proxy 컨벤션)
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg).*)",
  ],
};
