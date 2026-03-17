"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Plus, Search, Star, MapPin, Phone, Bookmark, BookmarkCheck, Loader2, Map, List, Navigation, RotateCcw, ExternalLink } from "lucide-react";
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
  distance?: number | null;
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
  const [selectedKakaoId, setSelectedKakaoId] = useState<string | null>(null);

  // Geolocation
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  // Map center (for "이 지역 재검색")
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [showReSearch, setShowReSearch] = useState(false);
  // GPS 위치 한 번만 이동용 (이후 사용자가 자유롭게 이동 가능)
  const [flyToOnce, setFlyToOnce] = useState<[number, number] | null>(null);

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

  async function searchKakao(opts?: { x?: number; y?: number; radius?: number; query?: string }) {
    const q = opts?.query ?? kakaoQuery;
    if (!q.trim()) return;
    setKakaoLoading(true);
    setKakaoResults([]);
    setSelectedKakaoId(null);
    setShowReSearch(false);
    const params = new URLSearchParams({ query: q });
    if (opts?.x != null && opts?.y != null) {
      params.set("x", String(opts.x));
      params.set("y", String(opts.y));
      if (opts.radius) params.set("radius", String(opts.radius));
    }
    const res = await fetch(`/api/places/search?${params}`);
    if (res.ok) {
      const data = await res.json();
      setKakaoResults(data.places ?? []);
      if (!data.places?.length) toast.info("검색 결과가 없습니다.");
    }
    setKakaoLoading(false);
  }

  async function handleMyLocation() {
    if (!navigator.geolocation) { toast.error("위치 서비스가 지원되지 않습니다."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation([lat, lng]);
        setMapCenter([lat, lng]);
        setFlyToOnce([lat, lng]); // 딱 한 번만 이동
        // 내 위치 근처 맛집 자동 검색
        if (kakaoQuery.trim()) {
          await searchKakao({ x: lng, y: lat, radius: 5000 });
        } else {
          await searchKakao({ query: "맛집", x: lng, y: lat, radius: 5000 });
        }
        setLocating(false);
        toast.success("현재 위치로 이동했습니다.");
      },
      () => { toast.error("위치를 가져올 수 없습니다."); setLocating(false); },
      { timeout: 8000 }
    );
  }

  async function handleReSearch() {
    if (!mapCenter) return;
    const q = kakaoQuery.trim() || "맛집";
    await searchKakao({ query: q, x: mapCenter[1], y: mapCenter[0], radius: 5000 });
  }

  // 카카오 검색 결과 → 지도 이동 (등록 다이얼로그 없이)
  function focusKakaoPlace(place: KakaoPlace) {
    setSelectedKakaoId(place.id);
    setSelectedId(null);
  }

  // 카카오 장소를 등록 폼에 채워서 다이얼로그 열기
  function registerKakaoPlace(place: KakaoPlace) {
    const catMap: Record<string, string> = {
      "한식": "한식", "중식": "중식", "일식": "일식", "양식": "양식",
      "카페": "카페", "제과,베이커리": "카페", "술집": "기타",
    };
    setForm({
      name: place.name,
      category: catMap[place.category] ?? "기타",
      address: place.address,
      roadAddress: place.roadAddress,
      phone: place.phone,
      url: place.url,
      description: "",
      latitude: String(place.latitude || ""),
      longitude: String(place.longitude || ""),
    });
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

  // Map data - useMemo로 안정화 (리렌더시 새 배열 생성 → setBounds 루프 방지)
  const mapRestaurants = useMemo<MapRestaurant[]>(() =>
    allRestaurants
      .filter(r => r.latitude && r.longitude)
      .map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        address: r.address,
        avgRating: r.avgRating,
        latitude: r.latitude!,
        longitude: r.longitude!,
      })),
  [allRestaurants]);

  const mapKakaoPlaces = useMemo<MapKakaoPlace[]>(() =>
    kakaoResults.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      address: p.address,
      roadAddress: p.roadAddress,
      latitude: p.latitude,
      longitude: p.longitude,
    })),
  [kakaoResults]);

  // Center map - useMemo로 참조 안정화 (같은 좌표면 effect 재실행 안 됨)
  const selectedRestaurant = selectedId ? allRestaurants.find(r => r.id === selectedId) : null;
  const selectedKakaoPlace = selectedKakaoId ? kakaoResults.find(p => p.id === selectedKakaoId) : null;
  // centerLatLng: 선택된 장소 or GPS 최초 1회만
  const centerLatLng = useMemo<[number, number] | null>(() => {
    if (selectedKakaoPlace?.latitude && selectedKakaoPlace?.longitude)
      return [selectedKakaoPlace.latitude, selectedKakaoPlace.longitude];
    if (selectedRestaurant?.latitude && selectedRestaurant?.longitude)
      return [selectedRestaurant.latitude, selectedRestaurant.longitude];
    return flyToOnce ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKakaoId, selectedId, flyToOnce]);

  return (
    <div className="flex flex-col -mx-4 md:-mx-6 -mt-4 md:-mt-6 -mb-20 md:-mb-6" style={{ height: "calc(100vh - 3.5rem)" }}>

      {/* ── 지도 영역 (상단 60%) ── */}
      <div className="relative flex-[3] min-h-0">
        {/* 지도 위 검색 overlay */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
          <div className="flex-1 flex gap-1 bg-white/95 dark:bg-zinc-900/95 shadow-md rounded-lg px-2 py-1.5 backdrop-blur">
            <Search className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
            <input
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="전국 맛집 검색 (예: 강남 삼겹살)"
              value={kakaoQuery}
              onChange={e => setKakaoQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchKakao()}
            />
            {kakaoLoading
              ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0 self-center" />
              : kakaoQuery && <button onClick={() => { setKakaoQuery(""); setKakaoResults([]); setSelectedKakaoId(null); }} className="text-muted-foreground hover:text-foreground shrink-0 self-center text-xs">✕</button>
            }
          </div>
          <button
            onClick={() => searchKakao()}
            className="bg-primary text-primary-foreground rounded-lg px-3 text-xs font-medium shadow-md hover:bg-primary/90"
          >
            검색
          </button>
          <button
            onClick={handleMyLocation}
            disabled={locating}
            className="bg-white/95 dark:bg-zinc-900/95 shadow-md rounded-lg px-2.5 backdrop-blur hover:bg-accent"
            title="현재 위치 근처 검색"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          </button>
        </div>

        {/* 카카오 검색 결과 드롭다운 */}
        {kakaoResults.length > 0 && (
          <div className="absolute top-14 left-3 right-3 z-20 bg-white dark:bg-zinc-900 shadow-xl rounded-xl border overflow-hidden max-h-64">
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
              <span className="text-[10px] font-medium text-blue-600">검색 결과 {kakaoResults.length}건 · 지도에 표시됨</span>
              <button onClick={() => { setKakaoResults([]); setSelectedKakaoId(null); }} className="text-[10px] text-muted-foreground hover:text-foreground">닫기</button>
            </div>
            <div className="overflow-y-auto max-h-52">
              {kakaoResults.map(place => (
                <div
                  key={place.id}
                  className={`border-b last:border-0 transition-colors ${selectedKakaoId === place.id ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/40"}`}
                >
                  <button onClick={() => focusKakaoPlace(place)} className="w-full text-left px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{place.name}</span>
                      {place.distance != null && (
                        <span className="text-[10px] text-blue-500 shrink-0">
                          {place.distance >= 1000 ? `${(place.distance / 1000).toFixed(1)}km` : `${place.distance}m`}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{place.category} · {place.roadAddress || place.address}</div>
                  </button>
                  <div className="flex gap-2 px-3 pb-1.5">
                    <button onClick={() => registerKakaoPlace(place)} className="text-[11px] text-primary hover:underline font-medium">+ 내 맛집 등록</button>
                    {place.url && (
                      <a href={place.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                        <ExternalLink className="w-2.5 h-2.5" /> 카카오맵
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 이 지역 재검색 */}
        {showReSearch && kakaoQuery && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={handleReSearch}
              className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 shadow-lg rounded-full px-3 py-1.5 text-xs font-medium border hover:bg-accent transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> 이 지역 재검색
            </button>
          </div>
        )}

        <RestaurantMap
          restaurants={mapRestaurants}
          kakaoPlaces={mapKakaoPlaces}
          selectedId={selectedId}
          onSelectRestaurant={handleSelectOnMap}
          onSelectKakaoPlace={place => focusKakaoPlace({ ...place, phone: "", url: "" })}
          centerLatLng={centerLatLng}
          zoomLevel={selectedKakaoId ? 4 : selectedId ? 4 : undefined}
          userLocation={userLocation}
          onMapIdle={(lat, lng) => {
            setMapCenter([lat, lng]);
            setShowReSearch(true);
            setFlyToOnce(null);
          }}
        />
      </div>

      {/* ── 내 맛집 리스트 (하단) ── */}
      <div className="flex-[2] min-h-0 flex flex-col border-t bg-background">
        {/* 헤더 + 필터 */}
        <div className="px-3 pt-2 pb-1.5 shrink-0 space-y-1.5 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">내 맛집 <span className="text-xs font-normal text-muted-foreground">{total}개</span></span>
            <Button size="sm" className="h-7 text-xs" onClick={() => setDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />등록
            </Button>
          </div>
          <div className="flex gap-1.5">
            <form onSubmit={handleSearch} className="flex gap-1 flex-1">
              <Input placeholder="내 맛집 검색..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="h-7 text-xs" />
              <Button type="submit" size="sm" variant="outline" className="h-7 px-2 shrink-0"><Search className="w-3 h-3" /></Button>
            </form>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
            <Button size="sm" variant={category === "" ? "default" : "outline"} className="h-6 text-[10px] px-2 shrink-0" onClick={() => setCategory("")}>전체</Button>
            {CATEGORIES.map(c => (
              <Button key={c} size="sm" variant={category === c ? "default" : "outline"} className="h-6 text-[10px] px-2 shrink-0" onClick={() => setCategory(c)}>{c}</Button>
            ))}
          </div>
        </div>

        {/* 리스트 */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-6 text-muted-foreground text-xs">불러오는 중...</div>
          ) : restaurants.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs">
              <p className="text-xl mb-1">🍽️</p><p>등록된 맛집이 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y">
              {restaurants.map(r => (
                <div
                  key={r.id}
                  data-id={r.id}
                  className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${selectedId === r.id ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-muted/40"}`}
                  onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[9px] px-1 shrink-0">{r.category}</Badge>
                      <Link href={`/restaurant/${r.id}`} className="font-semibold text-sm hover:underline truncate" onClick={e => e.stopPropagation()}>
                        {r.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarRating value={r.avgRating} />
                      <span className="text-[10px] text-muted-foreground truncate">{r.address}</span>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleBookmark(r); }} className="shrink-0 p-1 rounded hover:bg-accent">
                    {r.bookmarks.length > 0
                      ? <BookmarkCheck className="w-4 h-4 text-primary" />
                      : <Bookmark className="w-4 h-4 text-muted-foreground" />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center gap-1.5 py-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <Button key={p} size="sm" variant={p === page ? "default" : "outline"} className="w-7 h-7 p-0 text-xs" onClick={() => load(p)}>{p}</Button>
              ))}
            </div>
          )}
        </div>
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
                <Button size="sm" variant="outline" onClick={() => searchKakao()} disabled={kakaoLoading} className="h-8 shrink-0">
                  {kakaoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </Button>
              </div>
              {kakaoResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {kakaoResults.map(place => (
                    <button
                      key={place.id}
                      onClick={() => registerKakaoPlace(place)}
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
