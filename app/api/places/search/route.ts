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
  const radius = searchParams.get("radius") ?? "5000"; // meters, default 5km

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return NextResponse.json({ places: [], message: "KAKAO_REST_API_KEY not configured" });
  }

  try {
    const params = new URLSearchParams({
      query,
      category_group_code: "FD6",
      size: "30",
      sort: x && y ? "distance" : "accuracy",
    });
    if (x && y) {
      params.set("x", x);
      params.set("y", y);
      params.set("radius", radius);
    }
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`;
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
