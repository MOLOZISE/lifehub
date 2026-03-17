"use client";

import { useEffect, useRef, useState } from "react";

export interface MapRestaurant {
  id: string;
  name: string;
  category: string;
  address: string;
  avgRating: number;
  latitude: number;
  longitude: number;
}

export interface MapKakaoPlace {
  id: string;
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
}

interface Props {
  restaurants: MapRestaurant[];
  kakaoPlaces?: MapKakaoPlace[];
  selectedId: string | null;
  onSelectRestaurant: (id: string) => void;
  onSelectKakaoPlace?: (place: MapKakaoPlace) => void;
  centerLatLng?: [number, number] | null;
  userLocation?: [number, number] | null;
  onMapIdle?: (lat: number, lng: number) => void;
  zoomLevel?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKakao = any;

declare global {
  interface Window {
    kakao: { maps: AnyKakao };
    __selectKakaoPlace?: (id: string) => void;
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  "한식": "#ef4444",
  "중식": "#f97316",
  "일식": "#eab308",
  "양식": "#3b82f6",
  "카페": "#8b5cf6",
  "기타": "#6b7280",
};

const DEFAULT_CENTER: [number, number] = [37.5665, 126.9780];
const DEFAULT_LEVEL = 5;

function makeMarkerEl(color: string, size: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`,
    `background:${color}`,
    `border-radius:50%`,
    `border:2.5px solid white`,
    `box-shadow:0 2px 6px rgba(0,0,0,0.4)`,
    `cursor:pointer`,
  ].join(";");
  return el;
}

function makePopupEl(content: string, onClose: () => void): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:relative",
    "background:white",
    "border-radius:8px",
    "box-shadow:0 4px 16px rgba(0,0,0,0.2)",
    "padding:10px 14px 10px 12px",
    "min-width:175px",
    "font-family:sans-serif",
    "font-size:12px",
    "margin-bottom:8px",
  ].join(";");
  el.innerHTML = content;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = [
    "position:absolute", "top:6px", "right:8px",
    "background:none", "border:none", "cursor:pointer",
    "font-size:11px", "color:#aaa", "padding:0",
  ].join(";");
  closeBtn.onclick = onClose;
  el.appendChild(closeBtn);
  return el;
}

export default function RestaurantMap({
  restaurants,
  kakaoPlaces = [],
  selectedId,
  onSelectRestaurant,
  onSelectKakaoPlace,
  centerLatLng,
  userLocation,
  onMapIdle,
  zoomLevel,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<AnyKakao>(null);
  const markersRef = useRef<{ overlay: AnyKakao; id: string }[]>([]);
  const kakaoMarkersRef = useRef<{ overlay: AnyKakao; id: string }[]>([]);
  const userMarkerRef = useRef<AnyKakao>(null);
  const popupRef = useRef<AnyKakao>(null);
  const onMapIdleRef = useRef(onMapIdle);
  const [mapReady, setMapReady] = useState(false);
  const [sdkStatus, setSdkStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [sdkError, setSdkError] = useState<string | null>(null);

  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  function closePopup() {
    if (popupRef.current) {
      popupRef.current.setMap(null);
      popupRef.current = null;
    }
  }

  function openRestaurantPopup(r: MapRestaurant) {
    const map = mapInstanceRef.current;
    if (!map) return;
    closePopup();

    const stars = "★".repeat(Math.round(r.avgRating)) + "☆".repeat(5 - Math.round(r.avgRating));
    const content = makePopupEl(
      `<div style="font-weight:700;font-size:13px;margin-bottom:3px;padding-right:14px">${r.name}</div>
       <div style="color:#888;margin-bottom:${r.avgRating > 0 ? "4px" : "8px"}">${r.category} · ${r.address}</div>
       ${r.avgRating > 0 ? `<div style="color:#f59e0b;margin-bottom:8px">${stars} ${r.avgRating.toFixed(1)}</div>` : ""}
       <a href="/restaurant/${r.id}" style="display:block;text-align:center;padding:4px 0;background:#6366f1;color:white;border-radius:5px;text-decoration:none;font-size:11px">상세보기</a>`,
      closePopup,
    );

    const popup = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(r.latitude, r.longitude),
      content,
      map,
      zIndex: 10,
      yAnchor: 1.15,
      xAnchor: 0.5,
    });
    popupRef.current = popup;
  }

  function openKakaoPopup(place: MapKakaoPlace) {
    const map = mapInstanceRef.current;
    if (!map) return;
    closePopup();

    const content = makePopupEl(
      `<div style="font-weight:700;font-size:13px;margin-bottom:3px;padding-right:14px">${place.name}</div>
       <div style="color:#888;margin-bottom:8px">${place.category} · ${place.roadAddress || place.address}</div>
       <button onclick="window.__selectKakaoPlace('${place.id}')" style="width:100%;padding:4px 0;background:#3b82f6;color:white;border:none;border-radius:5px;cursor:pointer;font-size:11px">+ 맛집으로 등록</button>`,
      closePopup,
    );

    const popup = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(place.latitude, place.longitude),
      content,
      map,
      zIndex: 10,
      yAnchor: 1.15,
      xAnchor: 0.5,
    });
    popupRef.current = popup;
  }

  // ── 1. Load Kakao SDK and init map ──────────────────────────────────────
  useEffect(() => {
    if (!appKey || !mapRef.current) return;

    function createMap() {
      if (mapInstanceRef.current || !mapRef.current) return;
      try {
        const kakao = window.kakao;
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(DEFAULT_CENTER[0], DEFAULT_CENTER[1]),
          level: DEFAULT_LEVEL,
        });
        kakao.maps.event.addListener(map, "click", closePopup);
        mapInstanceRef.current = map;
        setSdkStatus("loaded");
        setMapReady(true);
      } catch (e) {
        setSdkStatus("error");
        setSdkError(`지도 초기화 실패: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (window.kakao?.maps) {
      window.kakao.maps.load(createMap);
      return;
    }

    const existing = document.getElementById("kakao-maps-sdk");
    if (existing) {
      existing.addEventListener("load", () => window.kakao?.maps.load(createMap));
      return;
    }

    const script = document.createElement("script");
    script.id = "kakao-maps-sdk";
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.onload = () => {
      try {
        window.kakao.maps.load(createMap);
      } catch (e) {
        setSdkStatus("error");
        setSdkError(`SDK load 실패: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    script.onerror = () => {
      setSdkStatus("error");
      setSdkError("SDK 스크립트 로드 실패 — API 키가 올바른지, Vercel에 NEXT_PUBLIC_KAKAO_MAP_KEY 가 등록됐는지 확인하세요.");
    };
    document.head.appendChild(script);

    return () => { closePopup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  // ── 2. Update restaurant markers ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    const kakao = window.kakao;

    markersRef.current.forEach(m => m.overlay.setMap(null));
    markersRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();
    let hasBounds = false;

    restaurants.forEach(r => {
      const isSelected = r.id === selectedId;
      const color = isSelected ? "#6366f1" : (CATEGORY_COLORS[r.category] ?? "#6b7280");
      const size = isSelected ? 18 : 12;
      const position = new kakao.maps.LatLng(r.latitude, r.longitude);
      const el = makeMarkerEl(color, size);

      el.addEventListener("click", () => {
        onSelectRestaurant(r.id);
        openRestaurantPopup(r);
      });

      const overlay = new kakao.maps.CustomOverlay({
        position, content: el, map,
        zIndex: isSelected ? 5 : 3,
        yAnchor: 0.5, xAnchor: 0.5,
      });

      markersRef.current.push({ overlay, id: r.id });
      bounds.extend(position);
      hasBounds = true;
    });

    if (hasBounds && !selectedId && !centerLatLng) {
      try { map.setBounds(bounds, 60, 60, 60, 60); } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, restaurants, selectedId]);

  // ── 3. Pan + popup when selectedId changes ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !selectedId) return;
    const map = mapInstanceRef.current;
    const kakao = window.kakao;
    const r = restaurants.find(x => x.id === selectedId);
    if (!r) return;
    map.setCenter(new kakao.maps.LatLng(r.latitude, r.longitude));
    const level = Math.min(map.getLevel(), 4);
    map.setLevel(level, { animate: true });
    setTimeout(() => openRestaurantPopup(r), 250);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, selectedId]);

  // ── 4. Update Kakao search result markers ───────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    const kakao = window.kakao;

    kakaoMarkersRef.current.forEach(m => m.overlay.setMap(null));
    kakaoMarkersRef.current = [];
    closePopup();

    if (kakaoPlaces.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();

    kakaoPlaces.forEach(place => {
      const position = new kakao.maps.LatLng(place.latitude, place.longitude);

      const el = document.createElement("div");
      el.style.cssText = "position:relative;width:14px;height:14px;cursor:pointer";
      el.innerHTML = `
        <div style="width:14px;height:14px;background:#3b82f6;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>
        <div style="position:absolute;top:-17px;left:50%;transform:translateX(-50%);background:#3b82f6;color:white;font-size:9px;padding:1px 5px;border-radius:3px;white-space:nowrap;font-family:sans-serif;">검색</div>
      `;
      el.addEventListener("click", () => openKakaoPopup(place));

      const overlay = new kakao.maps.CustomOverlay({
        position, content: el, map,
        zIndex: 4, yAnchor: 0.5, xAnchor: 0.5,
      });

      kakaoMarkersRef.current.push({ overlay, id: place.id });
      bounds.extend(position);
    });

    try { map.setBounds(bounds, 80, 80, 80, 80); } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, kakaoPlaces]);

  // ── 5a. User location marker ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !userLocation) return;
    const kakao = window.kakao;
    if (userMarkerRef.current) userMarkerRef.current.setMap(null);

    const el = document.createElement("div");
    el.style.cssText = "position:relative;width:16px;height:16px";
    el.innerHTML = `
      <div style="width:16px;height:16px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.3);"></div>
    `;
    userMarkerRef.current = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(userLocation[0], userLocation[1]),
      content: el,
      map: mapInstanceRef.current,
      zIndex: 10,
      yAnchor: 0.5,
      xAnchor: 0.5,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, userLocation]);

  // onMapIdle ref 최신화 (리렌더마다 새 함수여도 리스너 재등록 안 함)
  useEffect(() => { onMapIdleRef.current = onMapIdle; }, [onMapIdle]);

  // ── 5b. Map idle → notify parent (맵 준비 시 딱 한 번만 등록)
  useEffect(() => {
    if (!mapReady) return;
    const kakao = window.kakao;
    const map = mapInstanceRef.current;
    const handler = () => {
      const center = map.getCenter();
      onMapIdleRef.current?.(center.getLat(), center.getLng());
    };
    kakao.maps.event.addListener(map, "idle", handler);
    return () => kakao.maps.event.removeListener(map, "idle", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // ── 5. Pan to custom center ─────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mapReady || !centerLatLng) return;
    const map = mapInstanceRef.current;
    const kakao = window.kakao;
    map.setCenter(new kakao.maps.LatLng(centerLatLng[0], centerLatLng[1]));
    if (zoomLevel != null) map.setLevel(zoomLevel, { animate: true });
    // level 8 ≈ 10km, level 4 ≈ 500m
  }, [mapReady, centerLatLng?.[0], centerLatLng?.[1]]);

  // ── 6. Global handler for popup button ──────────────────────────────────
  useEffect(() => {
    window.__selectKakaoPlace = (placeId: string) => {
      const place = kakaoPlaces.find(p => p.id === placeId);
      if (place) onSelectKakaoPlace?.(place);
    };
    return () => { delete window.__selectKakaoPlace; };
  }, [kakaoPlaces, onSelectKakaoPlace]);

  // ── No API key fallback ─────────────────────────────────────────────────
  if (!appKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted text-center p-6">
        <div>
          <p className="text-2xl mb-2">🗺️</p>
          <p className="text-sm font-medium mb-1">카카오 지도 API 키 미설정</p>
          <p className="text-xs text-muted-foreground mb-2">
            Vercel 환경 변수에{" "}
            <code className="bg-background px-1 rounded font-mono">NEXT_PUBLIC_KAKAO_MAP_KEY</code>
            를 추가한 뒤 재배포하세요.
          </p>
          <p className="text-xs text-muted-foreground">
            (현재 빌드 시점에 키가 없어 지도를 표시할 수 없습니다)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {/* 디버그 오버레이 */}
      {sdkStatus !== "loaded" && (
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs rounded px-2 py-1 max-w-[90%] z-50">
          {sdkStatus === "loading" && "🔄 카카오 지도 SDK 로딩 중..."}
          {sdkStatus === "error" && (
            <span className="text-red-300">❌ {sdkError}</span>
          )}
        </div>
      )}
    </div>
  );
}
