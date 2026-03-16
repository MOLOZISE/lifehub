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

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    // No key configured - return empty results
    return NextResponse.json({ places: [], message: "KAKAO_REST_API_KEY not configured" });
  }

  try {
    // FD6 = 음식점 카테고리
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&category_group_code=FD6&size=10`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Kakao API error", places: [] }, { status: 200 });
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
    }));

    return NextResponse.json({ places });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: message, places: [] }, { status: 200 });
  }
}
