import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function todayStr() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "daily"; // "daily" | "tarot"
  const date = todayStr();

  const cached = await prisma.fortuneCache.findUnique({
    where: { userId_type_date: { userId: session.user.id, type, date } },
  });
  if (cached) return NextResponse.json({ ...cached.content, cached: true, date });

  return NextResponse.json({ cached: false, date });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, birthDate, birthTime } = await req.json();
  const date = todayStr();

  // Check cache first
  const cached = await prisma.fortuneCache.findUnique({
    where: { userId_type_date: { userId: session.user.id, type, date } },
  });
  if (cached) return NextResponse.json({ ...cached.content as object, cached: true });

  let prompt = "";
  const TAROT_CARDS = [
    "The Fool","The Magician","The High Priestess","The Empress","The Emperor",
    "The Hierophant","The Lovers","The Chariot","Strength","The Hermit",
    "Wheel of Fortune","Justice","The Hanged Man","Death","Temperance",
    "The Devil","The Tower","The Star","The Moon","The Sun","Judgement","The World",
    "Ace of Wands","Two of Wands","Three of Wands","Page of Cups","Knight of Swords","Queen of Pentacles",
  ];

  if (type === "tarot") {
    const cards = Array.from({ length: 3 }, () => TAROT_CARDS[Math.floor(Math.random() * TAROT_CARDS.length)]);
    const [past, present, future] = cards;
    prompt = `타로 카드 3장 뽑기 결과를 한국어로 해석해주세요.
과거 카드: ${past}
현재 카드: ${present}
미래 카드: ${future}

각 카드의 의미와 전체적인 흐름을 친근하고 긍정적인 톤으로 설명하되, 현실적인 조언도 함께 제공해주세요.
JSON 형식으로 응답:
{"cards":[{"position":"과거","name":"${past}","meaning":"...","advice":"..."},{"position":"현재","name":"${present}","meaning":"...","advice":"..."},{"position":"미래","name":"${future}","meaning":"...","advice":"..."}],"overall":"전체 흐름 요약 (2-3문장)","luckyColor":"오늘의 행운 색깔","luckyNumber":7}`;

  } else if (type === "saju" && birthDate) {
    const year = parseInt(birthDate.slice(0, 4));
    const month = parseInt(birthDate.slice(5, 7));
    const day = parseInt(birthDate.slice(8, 10));
    const timeHour = birthTime ? parseInt(birthTime.slice(0, 2)) : null;

    prompt = `사주 분석을 해주세요.
생년월일: ${year}년 ${month}월 ${day}일${timeHour !== null ? ` ${timeHour}시` : ""}
오늘 날짜: ${date}

한국의 사주명리학을 바탕으로 오늘의 운세를 분석해주세요.
JSON 형식으로 응답:
{"overall":"전체 운세 요약","categories":{"love":"연애운","money":"재물운","health":"건강운","work":"직업운"},"luckyColor":"행운의 색","luckyNumber":3,"luckyDirection":"행운의 방향","advice":"오늘의 조언 (2-3문장)","caution":"주의할 점"}`;

  } else {
    // daily fortune
    const dayOfWeek = ["일","월","화","수","목","금","토"][new Date().getDay()];
    prompt = `오늘(${date}, ${dayOfWeek}요일) 하루 운세를 한국어로 재미있고 긍정적으로 알려주세요.
JSON 형식으로 응답:
{"overall":"전체 운세 한 줄","score":85,"categories":{"love":"연애운","money":"재물운","health":"건강운","work":"직업/학업운"},"luckyColor":"행운의 색","luckyNumber":7,"luckyFood":"오늘의 음식","advice":"오늘의 한마디 조언"}`;
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const content = JSON.parse(text);

    await prisma.fortuneCache.create({
      data: { userId: session.user.id, type, date, content },
    });

    return NextResponse.json({ ...content, cached: false });
  } catch (e) {
    console.error("Fortune Groq error:", e);
    return NextResponse.json({ error: "운세 생성 실패" }, { status: 500 });
  }
}
