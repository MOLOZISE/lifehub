"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, RefreshCw, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { NewsArticle } from "@/app/api/news/route";

const CATEGORIES = [
  { key: "all",     label: "전체",    color: "bg-blue-500" },
  { key: "economy", label: "경제·주식", color: "bg-emerald-500" },
  { key: "tech",    label: "IT·기술",  color: "bg-violet-500" },
  { key: "society", label: "사회",    color: "bg-orange-500" },
  { key: "world",   label: "세계",    color: "bg-sky-500" },
  { key: "sports",  label: "스포츠",  color: "bg-rose-500" },
];

const CATEGORY_BORDER: Record<string, string> = {
  all:     "border-l-blue-400",
  economy: "border-l-emerald-400",
  tech:    "border-l-violet-400",
  society: "border-l-orange-400",
  world:   "border-l-sky-400",
  sports:  "border-l-rose-400",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

export default function NewsPage() {
  const [category, setCategory] = useState("all");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);

  const fetchNews = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?category=${cat}`);
      const data = await res.json();
      setArticles(data.articles ?? []);
      setCached(data.cached ?? false);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(category);
  }, [category, fetchNews]);

  const activeCat = CATEGORIES.find(c => c.key === category) ?? CATEGORIES[0];
  const borderClass = CATEGORY_BORDER[category] ?? "border-l-blue-400";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-blue-500" />
          <h1 className="text-xl font-bold">뉴스</h1>
          {cached && (
            <span className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">캐시</span>
          )}
        </div>
        <button
          onClick={() => fetchNews(category)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              category === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground/50 hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 기사 목록 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border rounded-xl p-4 border-l-4 border-l-muted">
              <div className="animate-pulse space-y-2.5">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="flex gap-2 pt-1">
                  <div className="h-4 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">뉴스를 불러오지 못했습니다.</p>
          <p className="text-xs mt-1 opacity-70">잠시 후 다시 시도해주세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((article, i) => (
            <a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className={`border border-l-4 ${borderClass} rounded-xl px-4 py-3.5 bg-card hover:bg-accent/40 transition-colors`}>
                <div className="flex items-start gap-3">
                  {/* 순번 */}
                  <span className={`shrink-0 w-6 h-6 rounded-full ${activeCat.color} text-white text-xs font-bold flex items-center justify-center mt-0.5 shadow-sm`}>
                    {i + 1}
                  </span>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* 제목 */}
                    <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </p>

                    {/* 요약 */}
                    {article.snippet && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {article.snippet}
                      </p>
                    )}

                    {/* 메타 */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                        {article.source}
                      </Badge>
                      {article.publishedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(article.publishedAt)}
                        </span>
                      )}
                      <span className="ml-auto">
                        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
