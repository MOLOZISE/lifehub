"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, BookOpen, TrendingUp, BarChart2 } from "lucide-react";

const tabs = [
  { label: "홈", href: "/", icon: LayoutDashboard },
  { label: "분석", href: "/study/analytics", icon: BarChart2 },
  { label: "과목", href: "/study/subjects", icon: BookOpen },
  { label: "자산", href: "/portfolio", icon: TrendingUp },
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
