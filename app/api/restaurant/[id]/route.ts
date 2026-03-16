import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      bookmarks: { where: { userId: session.user.id } },
    },
  });

  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(restaurant);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant || restaurant.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, category, address, roadAddress, latitude, longitude, phone, url, description } = body;

  const updated = await prisma.restaurant.update({
    where: { id },
    data: {
      name,
      category,
      address,
      roadAddress: roadAddress || null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      phone: phone || null,
      url: url || null,
      description: description || null,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant || restaurant.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.restaurant.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
