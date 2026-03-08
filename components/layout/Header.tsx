"use client";

import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/ThemeProvider";

const titles: Record<string, string> = {
  "/": "대시보드",
  "/study/subjects": "과목 관리",
  "/study/daily": "오늘의 플래너",
  "/portfolio": "포트폴리오",
  "/portfolio/chart": "차트 분석",
};

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const title =
    Object.entries(titles).find(([key]) => pathname === key || (key !== "/" && pathname.startsWith(key)))?.[1]
    ?? "LifeHub";

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 bg-background">
      <h1 className="text-base font-semibold">{title}</h1>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>
    </header>
  );
}
