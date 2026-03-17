"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Plus, Search, Star, MapPin, Phone, Bookmark, BookmarkCheck, Loader2, Map, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { MapRestaurant, MapKakaoPlace } from "@/components/restaurant/RestaurantMap";

const RestaurantMap = dynamic(() => import("@/components/restaurant/RestaurantMap"), { ssr: false });

const CATEGORIES = ["한식", "중식", "일식", "양식", "카페", "기타"];

interface Restaurant {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  url: string | null;
  description: string | null;
  avgRating: number;
  reviewCount: number;
  user: { id: string; name: string | null };
  bookmarks: { id: string; listName: string }[];
}

interface KakaoPlace {
  id: string;
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  phone: string;
  url: string;
  longitude: number;
  latitude: number;
}

const emptyForm = {
  name: "",
  category: "한식",
  address: "",
  roadAddress: "",
  phone: "",
  url: "",
  description: "",
  latitude: "",
  longitude: "",
};

function StarRating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{value > 0 ? value.toFixed(1) : "-"}</span>
    </span>
  );
}

export default function RestaurantPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Kakao search
  const [kakaoQuery, setKakaoQuery] = useState("");
  const [kakaoResults, setKakaoResults] = useState<KakaoPlace[]>([]);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  async function load(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "100" });
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    const res = await fetch(`/api/restaurant?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRestaurants(data.restaurants);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(p);
    }
    setLoading(false);
  }

  // Load all restaurants for map (without search filter)
  async function loadAll() {
    const res = await fetch(`/api/restaurant?limit=500`);
    if (res.ok) {
      const data = await res.json();
      setAllRestaurants(data.restaurants);
    }
  }

  useEffect(() => {
    load(1);
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  async function searchKakao() {
    if (!kakaoQuery.trim()) return;
    setKakaoLoading(true);
    setKakaoResults([]);
    const res = await fetch(`/api/places/search?query=${encodeURIComponent(kakaoQuery)}`);
    if (res.ok) {
      const data = await res.json();
      setKakaoResults(data.places ?? []);
      if (!data.places?.length) toast.info("검색 결과가 없습니다.");
    }
    setKakaoLoading(false);
  }

  function selectKakaoPlace(place: KakaoPlace) {
    const catMap: Record<string, string> = {
      "한식": "한식", "중식": "중식", "일식": "일식", "양식": "양식",
      "카페": "카페", "제과,베이커리": "카페", "술집": "기타",
    };
    const mappedCat = catMap[place.category] ?? "기타";
    setForm({
      name: place.name,
      category: mappedCat,
      address: place.address,
      roadAddress: place.roadAddress,
      phone: place.phone,
      url: place.url,
      description: "",
      latitude: String(place.latitude || ""),
      longitude: String(place.longitude || ""),
    });
    setKakaoResults([]);
    setKakaoQuery("");
    setDialogOpen(true);
  }

  function handleSelectOnMap(id: string) {
    setSelectedId(id);
    // Scroll to card in list
    setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-id="${id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }

  async function handleBookmark(r: Restaurant) {
    const isBookmarked = r.bookmarks.length > 0;
    const res = await fetch(`/api/restaurant/${r.id}/bookmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listName: isBookmarked ? r.bookmarks[0].listName : "가고 싶은 곳" }),
    });
    if (!res.ok) { toast.error("실패했습니다."); return; }
    const data = await res.json();
    toast.success(data.bookmarked ? "북마크에 추가했습니다." : "북마크를 해제했습니다.");
    load(page);
    loadAll();
  }

  async function handleAdd() {
    if (!form.name || !form.address) { toast.error("이름과 주소를 입력하세요."); return; }
    setSaving(true);
    const res = await fetch("/api/restaurant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("등록 실패"); return; }
    toast.success("맛집이 등록되었습니다!");
    setDialogOpen(false);
    setForm(emptyForm);
    load(1);
    loadAll();
  }

  // Map data
  const mapRestaurants: MapRestaurant[] = allRestaurants
    .filter(r => r.latitude && r.longitude)
    .map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      address: r.address,
      avgRating: r.avgRating,
      latitude: r.latitude!,
      longitude: r.longitude!,
    }));

  const mapKakaoPlaces: MapKakaoPlace[] = kakaoResults.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    address: p.address,
    roadAddress: p.roadAddress,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  // Center map on selected restaurant
  const selectedRestaurant = selectedId ? allRestaurants.find(r => r.id === selectedId) : null;
  const centerLatLng: [number, number] | null =
    selectedRestaurant?.latitude && selectedRestaurant?.longitude
      ? [selectedRestaurant.latitude, selectedRestaurant.longitude]
      : null;

  return (
    <div className="flex flex-col -mx-4 md:-mx-6 -mt-4 md:-mt-6 -mb-20 md:-mb-6" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-background">
        <h1 className="text-base font-bold">맛집 지도</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setShowMap(v => !v)}
          >
            {showMap ? <List className="w-3.5 h-3.5" /> : <Map className="w-3.5 h-3.5" />}
            {showMap ? "목록만" : "지도 보기"}
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />맛집 등록
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: filters + list */}
        <div
          className={`flex flex-col ${showMap ? "w-80 shrink-0 border-r" : "w-full"} overflow-hidden bg-background`}
        >
          {/* Filters */}
          <div className="p-3 space-y-2 border-b shrink-0">
            <form onSubmit={handleSearch} className="flex gap-1.5">
              <Input
                placeholder="맛집 이름, 주소 검색..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="h-7 text-xs"
              />
              <Button type="submit" size="sm" variant="outline" className="h-7 px-2"><Search className="w-3 h-3" /></Button>
            </form>
            {/* Kakao map search */}
            <div className="flex gap-1.5">
              <Input
                placeholder="카카오 지도 검색..."
                value={kakaoQuery}
                onChange={e => setKakaoQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchKakao()}
                className="h-7 text-xs"
              />
              <Button size="sm" variant="outline" onClick={searchKakao} disabled={kakaoLoading} className="h-7 px-2 shrink-0">
                {kakaoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
              </Button>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" variant={category === "" ? "default" : "outline"} className="h-6 text-[10px] px-2" onClick={() => setCategory("")}>전체</Button>
              {CATEGORIES.map(c => (
                <Button key={c} size="sm" variant={category === c ? "default" : "outline"} className="h-6 text-[10px] px-2" onClick={() => setCategory(c)}>{c}</Button>
              ))}
            </div>
          </div>

          {/* Kakao search results */}
          {kakaoResults.length > 0 && (
            <div className="border-b shrink-0">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <p className="text-[10px] font-medium text-blue-600">카카오 검색 결과 {kakaoResults.length}건 (지도에 표시됨)</p>
                <button onClick={() => setKakaoResults([])} className="text-[10px] text-muted-foreground hover:text-foreground">닫기</button>
              </div>
              <div className="max-h-40 overflow-y-auto px-3 pb-2 space-y-1">
                {kakaoResults.map(place => (
                  <button
                    key={place.id}
                    onClick={() => selectKakaoPlace(place)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs border"
                  >
                    <div className="font-medium truncate">{place.name}</div>
                    <div className="text-muted-foreground truncate text-[10px]">{place.roadAddress || place.address}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Restaurant list */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            <div className="px-3 py-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">총 {total}개</p>
            </div>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground text-xs">불러오는 중...</div>
            ) : restaurants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <p className="text-2xl mb-2">🍽️</p>
                <p>등록된 맛집이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-1.5 px-3 pb-3">
                {restaurants.map(r => (
                  <Card
                    key={r.id}
                    data-id={r.id}
                    className={`cursor-pointer transition-all ${selectedId === r.id ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm"}`}
                    onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Badge variant="secondary" className="text-[9px] px-1 shrink-0">{r.category}</Badge>
                            <Link
                              href={`/restaurant/${r.id}`}
                              className="font-semibold text-xs hover:underline truncate"
                              onClick={e => e.stopPropagation()}
                            >
                              {r.name}
                            </Link>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{r.address}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <StarRating value={r.avgRating} />
                            <span className="text-[10px] text-muted-foreground">리뷰 {r.reviewCount}개</span>
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleBookmark(r); }}
                          className="shrink-0 p-1 rounded-md hover:bg-accent transition-colors"
                        >
                          {r.bookmarks.length > 0
                            ? <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
                            : <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
                          }
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center gap-1.5 pb-3">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <Button key={p} size="sm" variant={p === page ? "default" : "outline"} className="w-7 h-7 p-0 text-xs" onClick={() => load(p)}>{p}</Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: map */}
        {showMap && (
          <div className="flex-1 relative">
            <RestaurantMap
              restaurants={mapRestaurants}
              kakaoPlaces={mapKakaoPlaces}
              selectedId={selectedId}
              onSelectRestaurant={handleSelectOnMap}
              onSelectKakaoPlace={place => {
                selectKakaoPlace({
                  id: place.id,
                  name: place.name,
                  category: place.category,
                  address: place.address,
                  roadAddress: place.roadAddress,
                  phone: "",
                  url: "",
                  latitude: place.latitude,
                  longitude: place.longitude,
                });
              }}
              centerLatLng={centerLatLng}
            />
          </div>
        )}
      </div>

      {/* Add dialog with Kakao search */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>맛집 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Kakao search */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">🔍 카카오 지도에서 검색 (자동 입력)</p>
              <div className="flex gap-2">
                <Input
                  placeholder="맛집 이름으로 검색..."
                  value={kakaoQuery}
                  onChange={e => setKakaoQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchKakao()}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={searchKakao} disabled={kakaoLoading} className="h-8 shrink-0">
                  {kakaoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </Button>
              </div>
              {kakaoResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {kakaoResults.map(place => (
                    <button
                      key={place.id}
                      onClick={() => selectKakaoPlace(place)}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs border"
                    >
                      <div className="font-medium">{place.name}</div>
                      <div className="text-muted-foreground">{place.roadAddress || place.address}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1">카테고리</p>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v ?? f.category }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs mb-1">상호명 *</p>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 진짜 맛있는 국밥" />
              </div>
            </div>
            <div>
              <p className="text-xs mb-1">주소 *</p>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="도로명 또는 지번 주소" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1">전화번호</p>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="02-1234-5678" />
              </div>
              <div>
                <p className="text-xs mb-1">지도 URL</p>
                <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="카카오/네이버 링크" />
              </div>
            </div>
            <div>
              <p className="text-xs mb-1">한줄 소개</p>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="이 맛집의 특징은..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "등록 중..." : "등록"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
