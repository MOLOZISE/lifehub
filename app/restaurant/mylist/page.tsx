"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Star, MapPin, BookmarkX, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const SITUATION_TAGS = [
  { label: "혼밥", emoji: "🍱", categories: ["한식", "일식", "카페"] },
  { label: "단체", emoji: "👥", categories: ["한식", "중식", "양식"] },
  { label: "데이트", emoji: "💑", categories: ["카페", "양식", "일식"] },
  { label: "야외", emoji: "🌿", categories: [] as string[], keywords: ["야외", "테라스", "루프탑", "정원"] },
  { label: "야식", emoji: "🌙", categories: [] as string[], keywords: ["야식", "24시", "심야"] },
];

interface RestaurantItem {
  id: string;
  name: string;
  category: string;
  address: string;
  avgRating: number;
  reviewCount: number;
  url: string | null;
  user: { id: string; name: string | null };
  bookmarks: { id: string; listName: string }[];
}

export default function MyListPage() {
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState("전체");
  const [situationTag, setSituationTag] = useState("");
  const [sort, setSort] = useState<"latest" | "rating" | "name">("latest");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/restaurant?limit=500");
    if (res.ok) {
      const data = await res.json();
      // 북마크한 것 = 내 맛집 (등록 시 자동 북마크 포함)
      setRestaurants((data.restaurants ?? []).filter((r: RestaurantItem) => r.bookmarks.length > 0));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function removeBookmark(r: RestaurantItem) {
    const listName = r.bookmarks[0]?.listName ?? "내 맛집";
    const res = await fetch(`/api/restaurant/${r.id}/bookmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listName }),
    });
    if (!res.ok) { toast.error("실패했습니다."); return; }
    toast.success("내 맛집에서 제거했습니다.");
    load();
  }

  const listNames = Array.from(new Set(restaurants.map(r => r.bookmarks[0]?.listName ?? "내 맛집")));
  const tabs = ["전체", ...listNames];

  const byList = activeList === "전체"
    ? restaurants
    : restaurants.filter(r => r.bookmarks[0]?.listName === activeList);

  const displayed = useMemo(() => {
    let list = byList;
    if (situationTag) {
      const tag = SITUATION_TAGS.find(t => t.label === situationTag);
      if (tag) {
        list = list.filter(r => {
          if (tag.categories.length && tag.categories.includes(r.category)) return true;
          if (tag.keywords?.length) {
            const text = `${r.name} ${r.address}`.toLowerCase();
            return tag.keywords.some(kw => text.includes(kw));
          }
          return false;
        });
      }
    }
    return [...list].sort((a, b) => {
      if (sort === "rating") return b.avgRating - a.avgRating;
      if (sort === "name") return a.name.localeCompare(b.name, "ko");
      return 0; // latest: 서버 반환 순서 유지
    });
  }, [byList, situationTag, sort]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">내 맛집 리스트</h1>
        <Link href="/restaurant">
          <Button size="sm" variant="outline" className="gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" />맛집 추가
          </Button>
        </Link>
      </div>

      {/* 리스트 탭 */}
      {tabs.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {tabs.map(name => (
            <Button
              key={name}
              size="sm"
              variant={activeList === name ? "default" : "outline"}
              className="h-8 text-xs gap-1.5"
              onClick={() => setActiveList(name)}
            >
              {name}
              <span className={`text-[10px] rounded-full px-1.5 ${activeList === name ? "bg-white/20" : "bg-muted"}`}>
                {name === "전체" ? restaurants.length : restaurants.filter(r => r.bookmarks[0]?.listName === name).length}
              </span>
            </Button>
          ))}
        </div>
      )}

      {/* 정렬 */}
      {restaurants.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">정렬:</span>
          {(["latest", "rating", "name"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                sort === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "latest" ? "최신" : s === "rating" ? "별점순" : "이름순"}
            </button>
          ))}
        </div>
      )}

      {/* 상황별 태그 필터 */}
      {restaurants.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">상황:</span>
          {SITUATION_TAGS.map(tag => (
            <button
              key={tag.label}
              onClick={() => setSituationTag(situationTag === tag.label ? "" : tag.label)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                situationTag === tag.label
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {tag.emoji} {tag.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">불러오는 중...</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-3xl mb-3">🍽️</p>
          <p className="text-sm">저장된 맛집이 없습니다.</p>
          <Link href="/restaurant">
            <Button variant="link" size="sm" className="mt-2">맛집 탐색 · 등록하러 가기</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(r => (
            <Card key={r.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] shrink-0">{r.category}</Badge>
                      <Link href={`/restaurant/${r.id}`} className="font-semibold text-sm hover:underline truncate">
                        {r.name}
                      </Link>
                      <Badge variant="outline" className="text-[10px] shrink-0 text-amber-600 border-amber-300">
                        {r.bookmarks[0]?.listName}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-52">{r.address}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {r.avgRating > 0 ? r.avgRating.toFixed(1) : "-"}
                        <span className="text-muted-foreground/60">({r.reviewCount})</span>
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeBookmark(r)}
                    className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-destructive shrink-0"
                    title="내 맛집에서 제거"
                  >
                    <BookmarkX className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
