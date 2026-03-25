"use client";

import { useEffect, useRef, useState } from "react";

export interface CourseMapItem {
  id: string;
  order: number;
  placeName: string;
  lat: number;
  lng: number;
}

interface Props {
  items: CourseMapItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKakao = any;

declare global {
  interface Window {
    kakao: { maps: AnyKakao };
  }
}

const DEFAULT_CENTER: [number, number] = [37.5665, 126.9780];
const THEME_COLOR = "#6366f1"; // indigo

function makeNumberedMarkerEl(order: number, selected: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "width:28px", "height:28px",
    `background:${selected ? "#4f46e5" : THEME_COLOR}`,
    "border-radius:50%",
    "border:2.5px solid white",
    `box-shadow:0 2px 6px rgba(0,0,0,${selected ? "0.6" : "0.3"})`,
    "cursor:pointer",
    "display:flex", "align-items:center", "justify-content:center",
    "color:white", "font-size:11px", "font-weight:700",
    "font-family:sans-serif",
    `transform:${selected ? "scale(1.2)" : "scale(1)"}`,
    "transition:transform 0.15s",
  ].join(";");
  el.textContent = String(order + 1);
  return el;
}

export default function CourseMap({ items, selectedId, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<AnyKakao>(null);
  const markersRef = useRef<{ overlay: AnyKakao; id: string }[]>([]);
  const polylineRef = useRef<AnyKakao>(null);
  const popupRef = useRef<AnyKakao>(null);
  const [mapReady, setMapReady] = useState(false);

  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  function closePopup() {
    if (popupRef.current) { popupRef.current.setMap(null); popupRef.current = null; }
  }

  // ── 1. SDK 로드 + 지도 초기화 ──────────────────────────────────────────
  useEffect(() => {
    if (!appKey || !mapRef.current) return;

    function createMap() {
      if (mapInstanceRef.current || !mapRef.current) return;
      try {
        const kakao = window.kakao;
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(DEFAULT_CENTER[0], DEFAULT_CENTER[1]),
          level: 5,
        });
        kakao.maps.event.addListener(map, "click", closePopup);
        mapInstanceRef.current = map;
        setMapReady(true);
      } catch { /* 초기화 실패 */ }
    }

    if (window.kakao?.maps) { window.kakao.maps.load(createMap); return; }

    const existing = document.getElementById("kakao-maps-sdk");
    if (existing) {
      existing.addEventListener("load", () => window.kakao?.maps.load(createMap));
      return;
    }

    const script = document.createElement("script");
    script.id = "kakao-maps-sdk";
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.onload = () => window.kakao.maps.load(createMap);
    document.head.appendChild(script);

    return () => { closePopup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  // ── 2. 마커 + 폴리라인 업데이트 ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    const kakao = window.kakao;

    // 기존 마커 제거
    markersRef.current.forEach(m => m.overlay.setMap(null));
    markersRef.current = [];
    closePopup();

    // 기존 폴리라인 제거
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }

    const validItems = items.filter(it => it.lat && it.lng);
    if (validItems.length === 0) return;

    const path: AnyKakao[] = [];

    validItems.forEach(item => {
      const pos = new kakao.maps.LatLng(item.lat, item.lng);
      path.push(pos);

      const el = makeNumberedMarkerEl(item.order, item.id === selectedId);
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content: el,
        map,
        zIndex: item.id === selectedId ? 5 : 3,
        yAnchor: 0.5,
        xAnchor: 0.5,
      });

      el.addEventListener("click", () => {
        onSelect(item.id);
        closePopup();
        // 간단한 팝업
        const popupEl = document.createElement("div");
        popupEl.style.cssText = [
          "background:white", "border-radius:8px",
          "box-shadow:0 4px 16px rgba(0,0,0,0.2)",
          "padding:8px 12px", "font-size:12px",
          "font-family:sans-serif", "white-space:nowrap",
          "margin-bottom:8px",
        ].join(";");
        popupEl.textContent = `${item.order + 1}. ${item.placeName}`;
        const popup = new kakao.maps.CustomOverlay({
          position: pos, content: popupEl, map, zIndex: 10, yAnchor: 1.15, xAnchor: 0.5,
        });
        popupRef.current = popup;
      });

      markersRef.current.push({ overlay, id: item.id });
    });

    // 폴리라인 그리기
    if (path.length > 1) {
      const polyline = new kakao.maps.Polyline({
        path,
        strokeWeight: 3,
        strokeColor: THEME_COLOR,
        strokeOpacity: 0.7,
        strokeStyle: "shortdash",
      });
      polyline.setMap(map);
      polylineRef.current = polyline;
    }

    // 전체 장소가 보이도록 bounds 설정
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    map.setBounds(bounds, 60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, items, selectedId]);

  if (!appKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-xl">
        <p className="text-xs text-muted-foreground">지도 API 키가 없습니다</p>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full rounded-xl" />;
}
