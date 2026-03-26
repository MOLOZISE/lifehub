"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKakao = any;

interface KakaoPlaceResult {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // lng
  y: string; // lat
}

interface RestaurantRef { id: string; name: string; category: string; address: string; latitude: number | null; longitude: number | null; avgRating: number; }

export interface TimelineItem {
  id: string; courseId: string; day: number; order: number;
  restaurantId: string | null; restaurant: { id: string; name: string; category: string; avgRating: number } | null;
  placeName: string; placeAddress: string;
  lat: number | null; lng: number | null;
  plannedTime: string | null; duration: number | null; note: string | null;
  kakaoPlaceId: string | null;
}

const EMPTY_FORM = {
  placeName: "", placeAddress: "", lat: "", lng: "",
  kakaoPlaceId: "", restaurantId: "",
  plannedTime: "", duration: "", note: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  totalDays: number;
  defaultDay: number;
  editingItem?: TimelineItem | null;
  onSaved: (item: TimelineItem, isEdit: boolean) => void;
}

export default function AddPlaceSheet({ open, onClose, courseId, totalDays, defaultDay, editingItem, onSaved }: Props) {
  const [tab, setTab] = useState<"kakao" | "restaurant" | "manual">("kakao");
  const [targetDay, setTargetDay] = useState(defaultDay);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 카카오 검색
  const [kakaoQuery, setKakaoQuery] = useState("");
  const [kakaoResults, setKakaoResults] = useState<KakaoPlaceResult[]>([]);
  const [kakaoSearching, setKakaoSearching] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [selectedKakaoPlace, setSelectedKakaoPlace] = useState<KakaoPlaceResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pollRef = useRef<ReturnType<typeof setTimeout>>();
  const pollCountRef = useRef(0);

  // 내 맛집
  const [myRestaurants, setMyRestaurants] = useState<RestaurantRef[]>([]);
  const [restSearch, setRestSearch] = useState("");
  const [restLoading, setRestLoading] = useState(false);
  const [restLoaded, setRestLoaded] = useState(false);

  // 편집 모드 초기화
  useEffect(() => {
    if (editingItem) {
      setForm({
        placeName: editingItem.placeName,
        placeAddress: editingItem.placeAddress,
        lat: editingItem.lat?.toString() ?? "",
        lng: editingItem.lng?.toString() ?? "",
        kakaoPlaceId: editingItem.kakaoPlaceId ?? "",
        restaurantId: editingItem.restaurantId ?? "",
        plannedTime: editingItem.plannedTime ?? "",
        duration: editingItem.duration?.toString() ?? "",
        note: editingItem.note ?? "",
      });
      setTargetDay(editingItem.day);
      setTab("manual");
    } else {
      setForm(EMPTY_FORM);
      setTargetDay(defaultDay);
      setTab("kakao");
      setKakaoQuery("");
      setKakaoResults([]);
      setSelectedKakaoPlace(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingItem, open]);

  // 카카오 SDK 준비 확인 (폴링)
  const checkKakaoReady = useCallback(() => {
    if (window.kakao?.maps?.services) {
      setKakaoReady(true);
      return;
    }
    if (pollCountRef.current >= 10) return;
    pollCountRef.current++;
    pollRef.current = setTimeout(checkKakaoReady, 500);
  }, []);

  useEffect(() => {
    if (!open) return;
    pollCountRef.current = 0;
    checkKakaoReady();
    return () => { clearTimeout(pollRef.current); };
  }, [open, checkKakaoReady]);

  // 카카오 검색 (debounce)
  useEffect(() => {
    if (!kakaoReady || !kakaoQuery.trim() || tab !== "kakao") {
      setKakaoResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setKakaoSearching(true);
      const ps = new (window.kakao as AnyKakao).maps.services.Places();
      ps.keywordSearch(kakaoQuery, (results: KakaoPlaceResult[], status: string) => {
        setKakaoSearching(false);
        if (status === "OK") setKakaoResults(results.slice(0, 10));
        else setKakaoResults([]);
      });
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [kakaoQuery, kakaoReady, tab]);

  // 내 맛집 로드
  useEffect(() => {
    if (tab !== "restaurant" || restLoaded) return;
    setRestLoading(true);
    fetch("/api/restaurant?limit=500")
      .then(r => r.json())
      .then(d => { setMyRestaurants(d.restaurants ?? []); setRestLoaded(true); })
      .catch(() => {})
      .finally(() => setRestLoading(false));
  }, [tab, restLoaded]);

  function selectKakaoPlace(place: KakaoPlaceResult) {
    setSelectedKakaoPlace(place);
    setForm(f => ({
      ...f,
      placeName: place.place_name,
      placeAddress: place.road_address_name || place.address_name,
      lat: place.y,
      lng: place.x,
      kakaoPlaceId: place.id,
      restaurantId: "",
    }));
  }

  function selectRestaurant(r: RestaurantRef) {
    setForm(f => ({
      ...f,
      placeName: r.name,
      placeAddress: r.address,
      lat: r.latitude?.toString() ?? "",
      lng: r.longitude?.toString() ?? "",
      restaurantId: r.id,
      kakaoPlaceId: "",
    }));
    setTab("manual");
  }

  async function handleSave() {
    if (!form.placeName.trim()) { toast.error("장소명을 입력해주세요"); return; }
    if (!form.placeAddress.trim()) { toast.error("주소를 입력해주세요"); return; }
    setSaving(true);
    try {
      const body = {
        day: targetDay,
        restaurantId: form.restaurantId || null,
        placeName: form.placeName,
        placeAddress: form.placeAddress,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        plannedTime: form.plannedTime || null,
        duration: form.duration ? parseInt(form.duration) : null,
        note: form.note || null,
        kakaoPlaceId: form.kakaoPlaceId || null,
      };

      if (editingItem) {
        const res = await fetch(`/api/course/${courseId}/items/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { toast.error("수정 실패"); return; }
        onSaved({ ...editingItem, ...data.item }, true);
        toast.success("수정됐어요");
      } else {
        const res = await fetch(`/api/course/${courseId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { toast.error("저장 실패"); return; }
        onSaved(data.item, false);
        toast.success("장소가 추가됐어요");
      }
      onClose();
    } catch { toast.error("오류가 발생했습니다"); }
    finally { setSaving(false); }
  }

  if (!open) return null;

  const showDetailForm = tab === "manual" || !!selectedKakaoPlace || !!editingItem;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-auto bg-background rounded-t-2xl shadow-2xl border-t p-5 space-y-4 max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">{editingItem ? "장소 편집" : "장소 추가"}</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        {/* 일차 선택 (추가 모드) */}
        {!editingItem && totalDays > 1 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">추가할 일차</p>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                <button
                  key={d}
                  onClick={() => setTargetDay(d)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                    ${targetDay === d
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "border-border text-muted-foreground hover:border-indigo-300"}`}
                >
                  {d}일차
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 탭 (추가 모드만) */}
        {!editingItem && (
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1 text-xs">
            {([
              { key: "kakao", label: "🔍 카카오 검색" },
              { key: "restaurant", label: "🍽️ 내 맛집" },
              { key: "manual", label: "✏️ 직접 입력" },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSelectedKakaoPlace(null); }}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all
                  ${tab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── 카카오 검색 탭 ── */}
        {tab === "kakao" && !editingItem && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={kakaoQuery}
                onChange={e => setKakaoQuery(e.target.value)}
                placeholder="장소명 또는 주소 검색..."
                className="pl-8 h-9 text-sm"
                autoFocus
              />
            </div>

            {!kakaoReady && (
              <p className="text-xs text-muted-foreground text-center py-2">지도 로딩 중...</p>
            )}

            {kakaoSearching && (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!kakaoSearching && kakaoResults.length > 0 && !selectedKakaoPlace && (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {kakaoResults.map(place => (
                  <button
                    key={place.id}
                    onClick={() => selectKakaoPlace(place)}
                    className="w-full flex items-start gap-2 p-2.5 rounded-lg hover:bg-muted/60 text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{place.place_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {place.category_name.split(" > ").pop()} · {place.road_address_name || place.address_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {kakaoReady && !kakaoSearching && kakaoQuery && kakaoResults.length === 0 && !selectedKakaoPlace && (
              <p className="text-xs text-muted-foreground text-center py-3">검색 결과가 없어요</p>
            )}

            {selectedKakaoPlace && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{selectedKakaoPlace.place_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedKakaoPlace.road_address_name || selectedKakaoPlace.address_name}</p>
                </div>
                <button
                  onClick={() => { setSelectedKakaoPlace(null); setForm(EMPTY_FORM); }}
                  className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                >
                  변경
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 내 맛집 탭 ── */}
        {tab === "restaurant" && !editingItem && (
          <div className="space-y-2">
            <Input
              placeholder="맛집 검색..."
              value={restSearch}
              onChange={e => setRestSearch(e.target.value)}
              className="h-8 text-sm"
            />
            {restLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {myRestaurants
                  .filter(r => !restSearch || r.name.includes(restSearch) || r.address.includes(restSearch))
                  .map(r => (
                    <button key={r.id} onClick={() => selectRestaurant(r)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/60 text-left transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.category} · {r.address}</p>
                      </div>
                      {r.avgRating > 0 && <span className="text-xs text-amber-500 shrink-0">★{r.avgRating.toFixed(1)}</span>}
                    </button>
                  ))}
                {myRestaurants.length === 0 && !restLoading && (
                  <p className="text-xs text-muted-foreground text-center py-3">저장한 맛집이 없어요</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 상세 폼 (직접 입력 탭 / 카카오 선택 후 / 편집 모드) ── */}
        {showDetailForm && (
          <div className="space-y-2.5">
            <div>
              <p className="text-xs text-muted-foreground mb-1">장소명 *</p>
              <Input value={form.placeName}
                onChange={e => setForm(f => ({ ...f, placeName: e.target.value }))}
                placeholder="예: 경복궁" className="h-9 text-sm" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">주소 *</p>
              <Input value={form.placeAddress}
                onChange={e => setForm(f => ({ ...f, placeAddress: e.target.value }))}
                placeholder="예: 서울 종로구 사직로 161" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">방문 예정 시간</p>
                <Input type="time" value={form.plannedTime}
                  onChange={e => setForm(f => ({ ...f, plannedTime: e.target.value }))}
                  className="h-9 text-sm" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">소요 시간 (분)</p>
                <Input type="number" min="0" placeholder="60" value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                  className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">메모 (선택)</p>
              <Textarea value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="예약 필요, 주차 가능 등..." className="h-16 text-sm resize-none" />
            </div>
          </div>
        )}

        {/* 저장 버튼 */}
        {showDetailForm && (
          <Button className="w-full h-9" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {editingItem ? "수정" : "추가"}
          </Button>
        )}
      </div>
    </div>
  );
}
