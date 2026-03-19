import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Star, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Restaurant {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  avgRating: number;
  reviewCount: number;
  phone: string | null;
  url: string | null;
}

interface ListItem {
  id: string;
  memo: string | null;
  addedAt: string;
  restaurant: Restaurant;
}

interface SharedList {
  id: string;
  name: string;
  emoji: string;
  color: string;
  ownerName: string | null;
  itemCount: number;
  items: ListItem[];
}

async function getSharedList(listId: string): Promise<SharedList | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/restaurant/shared/${listId}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${
            i <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground"
          }`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">
        {value > 0 ? value.toFixed(1) : "-"}
      </span>
    </span>
  );
}

export default async function SharedListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  const list = await getSharedList(listId);
  if (!list) notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{list.emoji}</span>
            <h1 className="text-xl font-bold">{list.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {list.ownerName}님의 맛집 리스트 · {list.itemCount}곳
          </p>
        </div>

        {/* 음식점 목록 */}
        <div className="space-y-3">
          {list.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">
                        {item.restaurant.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] shrink-0"
                      >
                        {item.restaurant.category}
                      </Badge>
                    </div>
                    <StarRating value={item.restaurant.avgRating} />
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {item.restaurant.address}
                    </p>
                    {item.memo && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        &ldquo;{item.memo}&rdquo;
                      </p>
                    )}
                  </div>
                  {item.restaurant.url && (
                    <a
                      href={item.restaurant.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {list.items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-3xl mb-2">🍽️</p>
            <p>아직 추가된 맛집이 없습니다</p>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/restaurant"
            className="text-sm text-primary hover:underline"
          >
            LifeHub에서 나만의 맛집 리스트 만들기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
