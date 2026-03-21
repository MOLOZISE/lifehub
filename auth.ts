import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { accounts: { where: { provider: "credentials" } } },
        });

        if (!user || !user.accounts[0]?.access_token) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.accounts[0].access_token
        );

        if (!isValid) return null;

        // 이메일 미인증 계정 차단
        if (!user.emailVerified) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),

    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
      : []),

    ...(process.env.AUTH_KAKAO_ID && process.env.AUTH_KAKAO_SECRET
      ? [Kakao({ clientId: process.env.AUTH_KAKAO_ID, clientSecret: process.env.AUTH_KAKAO_SECRET })]
      : []),
  ],

  events: {
    // 신규 유저 생성 시 기본 리스트 자동 생성 (맛집 + 관심 종목)
    async createUser({ user }) {
      const uid = user.id;
      if (!uid) return;

      await Promise.allSettled([
        // 기본 맛집 리스트
        prisma.restaurantList.findFirst({ where: { userId: uid } }).then(existing => {
          if (!existing) return prisma.restaurantList.create({
            data: { userId: uid, name: "내 맛집", emoji: "🍽️", color: "#6366f1", sortOrder: 0, isDefault: true },
          });
        }),
        // 기본 관심 종목 그룹
        prisma.watchlistGroup.findFirst({ where: { userId: uid } }).then(existing => {
          if (!existing) return prisma.watchlistGroup.create({
            data: { userId: uid, name: "My 종목", emoji: "⭐", color: "#f59e0b" },
          });
        }),
      ]);
    },
  },

  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as { username?: string }).username;
        // role을 DB에서 조회
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { role: true },
        });
        token.role = dbUser?.role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as { username?: string; role?: string }).username = token.username as string | undefined;
        (session.user as { username?: string; role?: string }).role = token.role as string | undefined;
      }
      return session;
    },
  },
});
