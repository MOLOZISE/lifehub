import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchStocks } from "@/lib/stocks-list";

// GET /api/portfolio/search?q=삼성&market=KR
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const market = searchParams.get("market") as "KR" | "US" | undefined;

  const results = searchStocks(q, market || undefined).slice(0, 20);
  return NextResponse.json(results);
}
