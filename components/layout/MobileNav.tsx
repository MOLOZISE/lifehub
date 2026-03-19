"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, TrendingUp, MessageSquare, Utensils,
  ChevronRight, X,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface SubItem { label: string; href: string; }
interface Tab {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: SubItem[];
}

const tabs: Tab[] = [
  { label: "홈", href: "/", icon: LayoutDashboard },
  {
    label: "학습", href: "/study/analytics", icon: BookOpen,
    children: [
      { label: "📚 과목 · 학습", href: "/study/subjects" },
      { label: "📊 학습 분석", href: "/study/analytics" },
      { label: "📅 시험 관리", href: "/study/exams" },
    ],
  },
  {
    label: "자산", href: "/portfolio", icon: TrendingUp,
    children: [
      { label: "📊 포트폴리오", href: "/portfolio" },
      { label: "⭐ 관심 종목", href: "/portfolio/watchlist" },
      { label: "📈 차트 분석", href: "/portfolio/chart" },
      { label: "📰 AI 뉴스·전략", href: "/portfolio/news" },
      { label: "📋 거래 내역", href: "/portfolio/trades" },
    ],
  },
  {
    label: "커뮤", href: "/community", icon: MessageSquare,
    children: [
      { label: "🗣️ 자유게시판", href: "/community?category=free" },
      { label: "📈 주식 토론방", href: "/community?category=stock" },
      { label: "📖 스터디 인증", href: "/community?category=study" },
      { label: "🍜 맛집 추천", href: "/community?category=restaurant" },
    ],
  },
  {
    label: "맛집", href: "/restaurant", icon: Utensils,
    children: [
      { label: "🗺️ 맛집 지도", href: "/restaurant" },
      { label: "⭐ 내 리스트", href: "/restaurant/mylist" },
    ],
  },
];

function isTabActive(tab: Tab, pathname: string) {
  if (tab.href === "/") return pathname === "/";
  return pathname.startsWith(tab.href.split("?")[0]);
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [openSheet, setOpenSheet] = useState<string | null>(null);

  function handleTabClick(tab: Tab) {
    if (!tab.children) {
      router.push(tab.href);
      return;
    }
    // 하위 메뉴가 있는 탭: 항상 Sheet 토글 (이미 열려있으면 닫기, 아니면 열기)
    setOpenSheet(prev => (prev === tab.label ? null : tab.label));
  }

  const activeSheetTab = tabs.find(t => t.label === openSheet);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex">
        {tabs.map((tab) => {
          const active = isTabActive(tab, pathname);
          return (
            <button
              key={tab.label}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                active ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <tab.icon className="w-5 h-5" />
                {tab.children && (
                  <span className={cn(
                    "absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full",
                    active ? "bg-primary" : "bg-muted-foreground/40"
                  )} />
                )}
              </div>
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* 하위 메뉴 Sheet */}
      <Sheet open={!!openSheet} onOpenChange={(open) => !open && setOpenSheet(null)}>
        <SheetContent side="bottom" className="md:hidden rounded-t-2xl pb-safe">
          <SheetHeader className="flex flex-row items-center justify-between pb-2">
            <SheetTitle className="text-base flex items-center gap-2">
              {activeSheetTab && <activeSheetTab.icon className="w-4 h-4" />}
              {activeSheetTab?.label} 메뉴
            </SheetTitle>
            <button
              onClick={() => setOpenSheet(null)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-1 pt-2 pb-6">
            {activeSheetTab?.children?.map((child) => {
              const basePath = child.href.split("?")[0];
              const active = pathname === basePath || pathname.startsWith(basePath + "/");
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setOpenSheet(null)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  {child.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
