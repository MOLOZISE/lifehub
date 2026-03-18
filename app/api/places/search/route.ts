import { NextRequest, NextResponse } from "next/server";

/**
 * Kakao Local API proxy for restaurant search
 * GET /api/places/search?query=강남 파스타
 * Requires: KAKAO_REST_API_KEY in env
 *
 * If no key, falls back to a mock response for development.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const x = searchParams.get("x");       // longitude
  const y = searchParams.get("y");       // latitude
  const radius = searchParams.get("radius") ?? "0"; // 0 = 반경 제한 없음

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return NextResponse.json({ places: [], message: "KAKAO_REST_API_KEY not configured" });
  }

  // category_group_code: FD6=음식점, CE7=카페 — 제한 없이 전체 검색 (카카오 키워드 검색 기본)
  const categoryCode = searchParams.get("category") ?? "";

  try {
    const params = new URLSearchParams({
      query,
      size: "15",
      sort: x && y ? "distance" : "accuracy",
    });
    if (categoryCode) params.set("category_group_code", categoryCode);
    if (x && y) {
      params.set("x", x);
      params.set("y", y);
      if (radius !== "0") params.set("radius", radius);
    }
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return NextResponse.json({
        error: `Kakao API ${res.status}`,
        kakaoError: errBody,
        places: [],
      }, { status: 200 });
    }

    const data = await res.json();
    const places = (data.documents ?? []).map((d: {
      id: string;
      place_name: string;
      category_name: string;
      address_name: string;
      road_address_name: string;
      phone: string;
      place_url: string;
      x: string;
      y: string;
      distance?: string;
    }) => ({
      id: d.id,
      name: d.place_name,
      category: d.category_name?.split(" > ").pop() ?? "기타",
      address: d.address_name,
      roadAddress: d.road_address_name,
      phone: d.phone,
      url: d.place_url,
      longitude: parseFloat(d.x),
      latitude: parseFloat(d.y),
      distance: d.distance ? parseInt(d.distance) : null,
    }));

    return NextResponse.json({ places });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: message, places: [] }, { status: 200 });
  }
}
