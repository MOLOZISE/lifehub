"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, RefreshCw, Newspaper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NewsArticle } from "@/app/api/news/route";

const CATEGORIES = [
  { key: "all",     label: "전체" },
  { key: "economy", label: "경제·주식" },
  { key: "tech",    label: "IT·기술" },
  { key: "society", label: "사회" },
  { key: "world",   label: "세계" },
  { key: "sports",  label: "스포츠" },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
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

  return (
    <div className="max-w-3xl mx-auto space-y-5">
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
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              category === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
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
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">뉴스를 불러오지 못했습니다.</p>
          <p className="text-xs mt-1">TAVILY_API_KEY가 설정되어 있는지 확인해주세요.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {articles.map((article, i) => (
            <a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug line-clamp-2 mb-1.5">
                        {article.title}
                      </p>
                      {article.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                          {article.snippet}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          {article.source}
                        </Badge>
                        {article.publishedAt && (
                          <span>{timeAgo(article.publishedAt)}</span>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
