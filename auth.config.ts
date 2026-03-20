import type { NextAuthConfig } from "next-auth";

// Edge 런타임 호환 설정 (Prisma 없음)
// middleware에서 사용
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: string } | undefined)?.role ?? "USER";
      const isPublicPath =
        nextUrl.pathname.startsWith("/auth/") ||
        nextUrl.pathname.startsWith("/api/auth/") ||
        nextUrl.pathname.startsWith("/api/official-exams");

      if (!isLoggedIn && !isPublicPath) {
        const signInUrl = new URL("/auth/signin", nextUrl.origin);
        signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);
        return Response.redirect(signInUrl);
      }

      // /admin/* — 관리자만 접근
      if (nextUrl.pathname.startsWith("/admin")) {
        if (!isLoggedIn || role !== "ADMIN") {
          return Response.redirect(new URL("/", nextUrl.origin));
        }
      }

      if (isLoggedIn && nextUrl.pathname.startsWith("/auth/")) {
        return Response.redirect(new URL("/", nextUrl.origin));
      }

      return true;
    },
  },
  providers: [], // middleware에서는 providers 불필요
};
