import { NextRequest, NextResponse } from "next/server";

const FOOD_CATEGORY_CODES = new Set(["FD6", "CE7"]); // 음식점, 카페

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const x = searchParams.get("x");
  const y = searchParams.get("y");
  const radius = searchParams.get("radius") ?? "0";

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return NextResponse.json({ places: [], message: "KAKAO_REST_API_KEY not configured" });
  }

  try {
    const params = new URLSearchParams({
      query,
      size: "15",
      sort: x && y ? "distance" : "accuracy",
    });
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
      return NextResponse.json({ error: `Kakao API ${res.status}`, kakaoError: errBody, places: [] });
    }

    const data = await res.json();
    const allPlaces = (data.documents ?? []) as {
      id: string; place_name: string; category_name: string;
      category_group_code: string; address_name: string;
      road_address_name: string; phone: string; place_url: string;
      x: string; y: string; distance?: string;
    }[];

    // 음식점(FD6) + 카페(CE7) 만 필터 — 나머지(병원, 편의점 등) 제외
    const foodPlaces = allPlaces.filter(d => FOOD_CATEGORY_CODES.has(d.category_group_code));

    // 음식 관련 결과가 없으면 전체 반환 (예: 브랜드명 직접 검색 시)
    const docs = foodPlaces.length > 0 ? foodPlaces : allPlaces;

    const places = docs.map(d => ({
      id: d.id,
      name: d.place_name,
      category: d.category_name?.split(" > ").pop() ?? "기타",
      categoryCode: d.category_group_code,
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
    return NextResponse.json({ error: message, places: [] });
  }
}
