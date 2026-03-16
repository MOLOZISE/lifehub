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
      const isPublicPath =
        nextUrl.pathname.startsWith("/auth/") ||
        nextUrl.pathname.startsWith("/api/auth/");

      if (!isLoggedIn && !isPublicPath) {
        const signInUrl = new URL("/auth/signin", nextUrl.origin);
        signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);
        return Response.redirect(signInUrl);
      }

      if (isLoggedIn && nextUrl.pathname.startsWith("/auth/")) {
        return Response.redirect(new URL("/", nextUrl.origin));
      }

      return true;
    },
  },
  providers: [], // middleware에서는 providers 불필요
};
