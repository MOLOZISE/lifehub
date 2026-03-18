import { type SubjectColor } from "./types";

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export const COLOR_MAP: Record<SubjectColor, { bg: string; text: string; border: string; light: string }> = {
  red:    { bg: "bg-red-500",    text: "text-red-500",    border: "border-red-500",    light: "bg-red-50 dark:bg-red-950" },
  orange: { bg: "bg-orange-500", text: "text-orange-500", border: "border-orange-500", light: "bg-orange-50 dark:bg-orange-950" },
  yellow: { bg: "bg-yellow-500", text: "text-yellow-500", border: "border-yellow-500", light: "bg-yellow-50 dark:bg-yellow-950" },
  green:  { bg: "bg-green-500",  text: "text-green-500",  border: "border-green-500",  light: "bg-green-50 dark:bg-green-950" },
  blue:   { bg: "bg-blue-500",   text: "text-blue-500",   border: "border-blue-500",   light: "bg-blue-50 dark:bg-blue-950" },
  indigo: { bg: "bg-indigo-500", text: "text-indigo-500", border: "border-indigo-500", light: "bg-indigo-50 dark:bg-indigo-950" },
  purple: { bg: "bg-purple-500", text: "text-purple-500", border: "border-purple-500", light: "bg-purple-50 dark:bg-purple-950" },
  pink:   { bg: "bg-pink-500",   text: "text-pink-500",   border: "border-pink-500",   light: "bg-pink-50 dark:bg-pink-950" },
};

export function getProfitColor(value: number): string {
  if (value > 0) return "text-red-500";   // 한국식: 상승 = 빨간색
  if (value < 0) return "text-blue-500";  // 하락 = 파란색
  return "text-muted-foreground";
}

export function formatCurrency(value: number | null | undefined, currency: "KRW" | "USD"): string {
  const v = value ?? 0;
  if (currency === "KRW") {
    return v.toLocaleString("ko-KR") + "원";
  }
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function formatDistanceToNow(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
