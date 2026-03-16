"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, TrendingUp, MessageSquare, Utensils } from "lucide-react";

const tabs = [
  { label: "홈",    href: "/",           icon: LayoutDashboard },
  { label: "학습",  href: "/study/analytics", icon: BookOpen },
  { label: "자산",  href: "/portfolio",  icon: TrendingUp },
  { label: "커뮤",  href: "/community",  icon: MessageSquare },
  { label: "맛집",  href: "/restaurant", icon: Utensils },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors",
              active ? "text-primary font-medium" : "text-muted-foreground"
            )}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
