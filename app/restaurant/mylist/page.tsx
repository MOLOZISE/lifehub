"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, MapPin, Bookmark, BookmarkX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface BookmarkedRestaurant {
  id: string;
  name: string;
  category: string;
  address: string;
  avgRating: number;
  reviewCount: number;
  url: string | null;
  bookmarks: { id: string; listName: string }[];
}

export default function MyListPage() {
  const [restaurants, setRestaurants] = useState<BookmarkedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState("전체");

  async function load() {
    const res = await fetch("/api/restaurant?my=1&page=1");
    if (res.ok) {
      const data = await res.json();
      // filter only bookmarked
      setRestaurants(data.restaurants.filter((r: BookmarkedRestaurant) => r.bookmarks.length > 0));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function removeBookmark(r: BookmarkedRestaurant) {
    const listName = r.bookmarks[0]?.listName ?? "가고 싶은 곳";
    const res = await fetch(`/api/restaurant/${r.id}/bookmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listName }),
    });
    if (!res.ok) { toast.error("실패했습니다."); return; }
    toast.success("북마크를 해제했습니다.");
    load();
  }

  const listNames = ["전체", ...Array.from(new Set(restaurants.map(r => r.bookmarks[0]?.listName ?? "가고 싶은 곳")))];
  const filtered = activeList === "전체"
    ? restaurants
    : restaurants.filter(r => r.bookmarks[0]?.listName === activeList);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-xl font-bold">내 맛집 리스트</h1>

      {/* List tabs */}
      <div className="flex gap-2 flex-wrap">
        {listNames.map(name => (
          <Button
            key={name}
            size="sm"
            variant={activeList === name ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setActiveList(name)}
          >
            {name}
            {name !== "전체" && (
              <span className="ml-1.5 text-[10px] bg-background/20 rounded-full px-1">
                {restaurants.filter(r => r.bookmarks[0]?.listName === name).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-3xl mb-3">🔖</p>
          <p className="text-sm">북마크한 맛집이 없습니다.</p>
          <Link href="/restaurant">
            <Button variant="link" size="sm" className="mt-2">맛집 탐색하러 가기</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px] shrink-0">{r.category}</Badge>
                      <Link href={`/restaurant/${r.id}`} className="font-semibold text-sm hover:underline truncate">{r.name}</Link>
                      <Badge variant="outline" className="text-[10px] shrink-0">{r.bookmarks[0]?.listName}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /><span className="truncate max-w-48">{r.address}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {r.avgRating > 0 ? r.avgRating.toFixed(1) : "-"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeBookmark(r)}
                    className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-destructive"
                    title="북마크 해제"
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
