"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, TrendingUp, MessageSquare, Utensils,
  Moon, Sun, ChevronRight, LogOut, User, LogIn, CalendarDays,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    label: "대시보드",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "플래너",
    href: "/planner",
    icon: CalendarDays,
  },
  {
    label: "학습",
    icon: BookOpen,
    children: [
      { label: "📚 학습 관리", href: "/study/subjects" },
      { label: "📊 학습 분석", href: "/study/analytics" },
    ],
  },
  {
    label: "자산 관리",
    icon: TrendingUp,
    children: [
      { label: "📡 증권 동향", href: "/stock" },
      { label: "📊 포트폴리오", href: "/portfolio" },
      { label: "⭐ 관심 종목", href: "/portfolio/watchlist" },
    ],
  },
  {
    label: "커뮤니티",
    icon: MessageSquare,
    children: [
      { label: "🗣️ 자유게시판", href: "/community?category=free" },
      { label: "📈 주식 토론방", href: "/community?category=stock" },
      { label: "📖 스터디 인증", href: "/community?category=study" },
      { label: "🍜 맛집 추천", href: "/community?category=restaurant" },
    ],
  },
  {
    label: "맛집",
    icon: Utensils,
    children: [
      { label: "🗺️ 맛집 지도", href: "/restaurant" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-background border-r">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
          L
        </div>
        <span className="font-bold text-lg tracking-tight">LifeHub</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (!item.children) {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          }

          const groupActive = item.children.some(
            (c) => pathname === c.href || pathname.startsWith(c.href.split("?")[0] + "/")
          );

          return (
            <div key={item.label} className="space-y-1">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium",
                  groupActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </div>
              <div className="ml-4 space-y-0.5 border-l pl-3">
                {item.children.map((child) => {
                  const basePath = child.href.split("?")[0];
                  const active = pathname === basePath || pathname.startsWith(basePath + "/");
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-accent text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      <ChevronRight className="w-3 h-3 shrink-0" />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom area */}
      <div className="px-3 py-4 border-t space-y-1">
        {/* User info / login */}
        {session?.user ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50">
              <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {session.user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="text-sm font-medium truncate">{session.user.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => router.push("/profile")}
            >
              <User className="w-4 h-4" />
              프로필
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => router.push("/auth/signin")}
          >
            <LogIn className="w-4 h-4" />
            로그인
          </Button>
        )}

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "라이트 모드" : "다크 모드"}
        </Button>
      </div>
    </aside>
  );
}
