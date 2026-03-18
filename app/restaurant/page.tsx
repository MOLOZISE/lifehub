"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Plus, Search, Star, MapPin, Phone, Bookmark, BookmarkCheck, Loader2, Navigation, RotateCcw, ExternalLink } from "lucide-react";
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

const SITUATION_TAGS: { label: string; emoji: string; categories: string[]; keywords?: string[] }[] = [
  { label: "혼밥", emoji: "🍱", categories: ["한식", "일식", "카페"] },
  { label: "단체", emoji: "👥", categories: ["한식", "중식", "양식"] },
  { label: "데이트", emoji: "💑", categories: ["카페", "양식", "일식"] },
  { label: "야외", emoji: "🌿", categories: [], keywords: ["야외", "테라스", "루프탑", "정원"] },
];

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
  const [sort, setSort] = useState<"latest" | "rating">("latest");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<"search" | "mylist">("search");
  const [situationTag, setSituationTag] = useState<string>("");

  // Kakao search
  const [kakaoQuery, setKakaoQuery] = useState("");
  const [kakaoResults, setKakaoResults] = useState<KakaoPlace[]>([]);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [selectedKakaoId, setSelectedKakaoId] = useState<string | null>(null);

  // Geolocation
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);

  // Map center
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [showReSearch, setShowReSearch] = useState(false);
  const [flyToOnce, setFlyToOnce] = useState<[number, number] | null>(null);

  // Resizable map/list split
  const [mapHeightPct, setMapHeightPct] = useState(50);
  const dragState = useRef<{ startY: number; startH: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startY: e.clientY, startH: mapHeightPct };
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current || !containerRef.current) return;
      const h = containerRef.current.clientHeight;
      const delta = ev.clientY - dragState.current.startY;
      setMapHeightPct(Math.min(75, Math.max(20, dragState.current.startH + (delta / h) * 100)));
    };
    const onUp = () => { dragState.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [mapHeightPct]);

  const onHandleTouchStart = useCallback((e: React.TouchEvent) => {
    dragState.current = { startY: e.touches[0].clientY, startH: mapHeightPct };
    const onMove = (ev: TouchEvent) => {
      if (!dragState.current || !containerRef.current) return;
      const h = containerRef.current.clientHeight;
      const delta = ev.touches[0].clientY - dragState.current.startY;
      setMapHeightPct(Math.min(75, Math.max(20, dragState.current.startH + (delta / h) * 100)));
    };
    const onEnd = () => { dragState.current = null; window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }, [mapHeightPct]);

  async function load(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "100", sort });
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
  }, [category, search, sort]);

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
    const coordX = opts?.x ?? (userLocation ? userLocation[1] : null);
    const coordY = opts?.y ?? (userLocation ? userLocation[0] : null);
    if (coordX != null && coordY != null) {
      params.set("x", String(coordX));
      params.set("y", String(coordY));
      if (opts?.radius) params.set("radius", String(opts.radius));
    }

    const res = await fetch(`/api/places/search?${params}`);
    if (res.ok) {
      const data = await res.json();
      const places: KakaoPlace[] = data.places ?? [];
      setKakaoResults(places);
      setActiveTab("search"); // 검색 결과 탭으로 자동 전환
      if (data.error) {
        toast.error(`검색 오류: ${data.error} ${JSON.stringify(data.kakaoError ?? "")}`);
      } else if (!places.length) {
        toast.info("검색 결과가 없습니다.");
      } else {
        setSelectedKakaoId(places[0].id);
        setFlyToOnce([places[0].latitude, places[0].longitude]);
      }
    }
    setKakaoLoading(false);
  }

  // 내 맛집 탭 전환 시 첫 번째 식당 자동 선택
  function switchToMylist() {
    setActiveTab("mylist");
    setSelectedKakaoId(null);
    if (restaurants.length > 0) {
      const first = restaurants[0];
      setSelectedId(first.id);
      if (first.latitude && first.longitude) {
        setFlyToOnce([first.latitude, first.longitude]);
      }
    }
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
        setFlyToOnce([lat, lng]);
        const gpsQuery = kakaoQuery.trim() || "맛집";
        await searchKakao({ query: gpsQuery, x: lng, y: lat, radius: 3000 });
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
    await searchKakao({ query: q, x: mapCenter[1], y: mapCenter[0], radius: 20000 });
  }

  function focusKakaoPlace(place: KakaoPlace) {
    setSelectedKakaoId(place.id);
    setSelectedId(null);
  }

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

  // 상황별 태그 클라이언트 필터
  const filteredRestaurants = useMemo(() => {
    if (!situationTag) return restaurants;
    const tag = SITUATION_TAGS.find(t => t.label === situationTag);
    if (!tag) return restaurants;
    return restaurants.filter(r => {
      const matchCategory = tag.categories.length === 0 || tag.categories.includes(r.category);
      const matchKeyword = tag.keywords?.some(kw =>
        r.name.includes(kw) || r.description?.includes(kw) || r.address?.includes(kw)
      ) ?? false;
      return tag.keywords && tag.keywords.length > 0 ? matchKeyword : matchCategory;
    });
  }, [restaurants, situationTag]);

  const selectedRestaurant = selectedId ? allRestaurants.find(r => r.id === selectedId) : null;
  const selectedKakaoPlace = selectedKakaoId ? kakaoResults.find(p => p.id === selectedKakaoId) : null;
  const centerLatLng = useMemo<[number, number] | null>(() => {
    if (selectedKakaoPlace?.latitude && selectedKakaoPlace?.longitude)
      return [selectedKakaoPlace.latitude, selectedKakaoPlace.longitude];
    if (selectedRestaurant?.latitude && selectedRestaurant?.longitude)
      return [selectedRestaurant.latitude, selectedRestaurant.longitude];
    return flyToOnce ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKakaoId, selectedId, flyToOnce]);

  return (
    <div ref={containerRef} className="flex flex-col -mx-4 md:-mx-6 -mt-4 md:-mt-6 -mb-20 md:-mb-6" style={{ height: "calc(100vh - 3.5rem)" }}>

      {/* ── 지도 영역 ── */}
      <div className="relative min-h-0" style={{ height: `${mapHeightPct}%` }}>
        {/* GPS 버튼만 지도 위에 */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
          <button
            onClick={handleMyLocation}
            disabled={locating}
            className="bg-white/95 dark:bg-zinc-900/95 shadow-md rounded-lg p-2.5 backdrop-blur hover:bg-accent"
            title="현재 위치 근처 검색"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          </button>
        </div>

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
          onSelectRestaurant={(id) => {
            setSelectedId(id);
            setActiveTab("mylist");
          }}
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

      {/* ── 드래그 핸들 ── */}
      <div
        className="shrink-0 flex items-center justify-center h-4 bg-background border-t border-b cursor-row-resize select-none touch-none z-10"
        onMouseDown={onHandleMouseDown}
        onTouchStart={onHandleTouchStart}
      >
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* ── 하단 패널 ── */}
      <div className="flex-1 min-h-0 flex flex-col bg-background">

        {/* 탭 바 */}
        <div className="flex items-center border-b shrink-0">
          <button
            className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "search"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
            onClick={() => setActiveTab("search")}
          >
            🔍 검색 결과 {kakaoResults.length > 0 ? `(${kakaoResults.length})` : ""}
          </button>
          <button
            className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "mylist"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
            onClick={switchToMylist}
          >
            ⭐ 내 맛집 {total > 0 ? `(${total})` : ""}
          </button>
          <Button size="sm" className="h-7 text-xs mx-2 shrink-0" onClick={() => setDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />등록
          </Button>
        </div>

        {/* ── 검색 탭 ── */}
        {activeTab === "search" && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* 검색 입력창 */}
            <div className="px-2 py-2 border-b shrink-0 flex gap-1.5">
              <div className="flex-1 flex gap-1 bg-muted/50 rounded-lg px-2.5 py-1.5">
                <Search className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
                <input
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                  placeholder="전국 맛집 검색 (예: 강남 삼겹살, 스타벅스)"
                  value={kakaoQuery}
                  onChange={e => setKakaoQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchKakao()}
                />
                {kakaoLoading
                  ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0 self-center" />
                  : kakaoQuery && (
                    <button
                      onClick={() => { setKakaoQuery(""); setKakaoResults([]); setSelectedKakaoId(null); }}
                      className="text-muted-foreground hover:text-foreground shrink-0 self-center text-xs"
                    >✕</button>
                  )
                }
              </div>
              <button
                onClick={() => searchKakao()}
                className="bg-primary text-primary-foreground rounded-lg px-3 text-xs font-medium hover:bg-primary/90"
              >
                검색
              </button>
              <button
                onClick={handleMyLocation}
                disabled={locating}
                className="bg-muted rounded-lg px-2.5 hover:bg-accent"
                title="현재 위치 근처 검색"
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              </button>
            </div>

            {/* 검색 결과 리스트 */}
            <div className="flex-1 overflow-y-auto divide-y">
              {kakaoResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-xs gap-2 pb-4">
                  <p className="text-3xl">🔍</p>
                  <p className="font-medium">검색어를 입력해보세요</p>
                  <p className="text-[11px]">내 위치 버튼으로 근처 맛집도 찾을 수 있어요</p>
                </div>
              ) : (
                kakaoResults.map(place => (
                  <div
                    key={place.id}
                    className={`transition-colors ${selectedKakaoId === place.id ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/40"}`}
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
                ))
              )}
            </div>
          </div>
        )}

        {/* ── 내 맛집 탭 ── */}
        {activeTab === "mylist" && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* 필터 */}
            <div className="px-2 py-1.5 border-b shrink-0 space-y-1.5">
              <div className="flex gap-1.5">
                <form onSubmit={handleSearch} className="flex gap-1 flex-1">
                  <Input placeholder="내 맛집 검색..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="h-7 text-xs" />
                  <Button type="submit" size="sm" variant="outline" className="h-7 px-2 shrink-0"><Search className="w-3 h-3" /></Button>
                </form>
                <Select value={sort} onValueChange={v => setSort(v as "latest" | "rating")}>
                  <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">최신순</SelectItem>
                    <SelectItem value="rating">별점순</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                <Button size="sm" variant={category === "" ? "default" : "outline"} className="h-6 text-[10px] px-2 shrink-0" onClick={() => setCategory("")}>전체</Button>
                {CATEGORIES.map(c => (
                  <Button key={c} size="sm" variant={category === c ? "default" : "outline"} className="h-6 text-[10px] px-2 shrink-0" onClick={() => setCategory(c)}>{c}</Button>
                ))}
              </div>
              <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {SITUATION_TAGS.map(t => (
                  <Button
                    key={t.label}
                    size="sm"
                    variant={situationTag === t.label ? "default" : "ghost"}
                    className="h-6 text-[10px] px-2 shrink-0 gap-0.5"
                    onClick={() => setSituationTag(situationTag === t.label ? "" : t.label)}
                  >
                    {t.emoji} {t.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* 내 맛집 리스트 (카카오 결과와 동일한 스타일) */}
            <div ref={listRef} className="flex-1 overflow-y-auto divide-y">
              {loading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...
                </div>
              ) : filteredRestaurants.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-xs gap-2 pb-4">
                  <p className="text-3xl">🍽️</p>
                  <p className="font-medium">{situationTag ? `'${situationTag}' 조건의 맛집이 없습니다` : "등록된 맛집이 없습니다"}</p>
                  {!situationTag && <button onClick={() => setDialogOpen(true)} className="text-primary hover:underline">+ 첫 맛집 등록하기</button>}
                </div>
              ) : (
                filteredRestaurants.map(r => (
                  <div
                    key={r.id}
                    data-id={r.id}
                    className={`transition-colors ${selectedId === r.id ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/40"}`}
                  >
                    <button
                      onClick={() => {
                        setSelectedId(r.id);
                        setSelectedKakaoId(null);
                        if (r.latitude && r.longitude) setFlyToOnce([r.latitude, r.longitude]);
                      }}
                      className="w-full text-left px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{r.category}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating value={r.avgRating} />
                        <span className="text-[11px] text-muted-foreground truncate">{r.address}</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 px-3 pb-1.5">
                      <Link
                        href={`/restaurant/${r.id}`}
                        className="text-[11px] text-primary hover:underline font-medium"
                        onClick={e => e.stopPropagation()}
                      >
                        리뷰 보기
                      </Link>
                      <Link
                        href={`/restaurant/${r.id}?review=1`}
                        className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        ✏️ 리뷰 쓰기
                      </Link>
                      {r.phone && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" /> {r.phone}
                        </span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); handleBookmark(r); }}
                        className="ml-auto shrink-0 p-1 rounded hover:bg-accent"
                      >
                        {r.bookmarks.length > 0
                          ? <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
                          : <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                      </button>
                    </div>
                  </div>
                ))
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
        )}
      </div>

      {/* 등록 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>맛집 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
