"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, TrendingUp,
  Moon, Sun, ChevronRight,
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
    label: "학습 앱",
    icon: BookOpen,
    children: [
      { label: "📊 학습 분석", href: "/study/analytics" },
      { label: "🎯 시험 관리", href: "/study/exams" },
      { label: "📝 세션 기록", href: "/study/sessions" },
      { label: "❌ 오답 노트", href: "/study/wrong-answers" },
      { label: "📚 과목 관리", href: "/study/subjects" },
      { label: "🍅 오늘의 플래너", href: "/study/daily" },
    ],
  },
  {
    label: "자산 관리",
    icon: TrendingUp,
    children: [
      { label: "포트폴리오", href: "/portfolio" },
      { label: "차트 분석", href: "/portfolio/chart" },
      { label: "AI 뉴스 분석", href: "/portfolio/news" },
      { label: "AI 전략 어드바이저", href: "/portfolio/strategy" },
      { label: "주식 공부방", href: "/portfolio/learn" },
      { label: "전략 메모", href: "/portfolio/memo" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

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

          const groupActive = item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));

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
                  const active = pathname === child.href || pathname.startsWith(child.href + "/");
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

      {/* Theme toggle */}
      <div className="px-3 py-4 border-t">
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
