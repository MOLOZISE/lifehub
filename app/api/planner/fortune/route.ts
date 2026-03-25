import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { geminiGenerateJson } from "@/lib/gemini";

function todayStr() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  // 월별 운세 기록 목록 반환 (플래너 달력용)
  if (month) {
    const records = await prisma.fortuneCache.findMany({
      where: {
        userId: session.user.id,
        date: { gte: `${month}-01`, lte: `${month}-31` },
      },
      select: { type: true, date: true, content: true },
      orderBy: { date: "asc" },
    });
    const map: Record<string, { overall: string; type: string }> = {};
    for (const r of records) {
      const content = r.content as Record<string, unknown>;
      const overall = (content.overall as string) ?? "";
      // 같은 날 여러 기록이면 daily 우선
      if (!map[r.date] || r.type === "daily") {
        map[r.date] = { overall, type: r.type };
      }
    }
    return NextResponse.json({ fortuneMap: map });
  }

  const type = searchParams.get("type") ?? "daily";
  const date = todayStr();

  const cached = await prisma.fortuneCache.findUnique({
    where: { userId_type_date: { userId: session.user.id, type, date } },
  });
  if (cached) return NextResponse.json({ ...(cached.content as object), cached: true, date, generatedAt: cached.createdAt.toISOString() });

  return NextResponse.json({ cached: false, date });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, birthDate, birthTime, gender, pickedCards: userPickedCards, question, sajuStart, sajuEnd } = await req.json();
  const date = todayStr();

  const cached = await prisma.fortuneCache.findUnique({
    where: { userId_type_date: { userId: session.user.id, type, date } },
  });
  if (cached) return NextResponse.json({ ...cached.content as object, cached: true });

  const TAROT_DECK = [
    "The Fool","The Magician","The High Priestess","The Empress","The Emperor",
    "The Hierophant","The Lovers","The Chariot","Strength","The Hermit",
    "Wheel of Fortune","Justice","The Hanged Man","Death","Temperance",
    "The Devil","The Tower","The Star","The Moon","The Sun","Judgement","The World",
    "Ace of Wands","Two of Wands","Three of Wands","Four of Wands","Five of Wands",
    "Six of Wands","Seven of Wands","Eight of Wands","Nine of Wands","Ten of Wands",
    "Page of Wands","Knight of Wands","Queen of Wands","King of Wands",
    "Ace of Cups","Two of Cups","Three of Cups","Four of Cups","Five of Cups",
    "Six of Cups","Seven of Cups","Eight of Cups","Nine of Cups","Ten of Cups",
    "Page of Cups","Knight of Cups","Queen of Cups","King of Cups",
    "Ace of Swords","Two of Swords","Three of Swords","Four of Swords","Five of Swords",
    "Six of Swords","Seven of Swords","Eight of Swords","Nine of Swords","Ten of Swords",
    "Page of Swords","Knight of Swords","Queen of Swords","King of Swords",
    "Ace of Pentacles","Two of Pentacles","Three of Pentacles","Four of Pentacles","Five of Pentacles",
    "Six of Pentacles","Seven of Pentacles","Eight of Pentacles","Nine of Pentacles","Ten of Pentacles",
    "Page of Pentacles","Knight of Pentacles","Queen of Pentacles","King of Pentacles",
  ];

  let systemPrompt = "";
  let userPrompt = "";

  // ── 타로 ──────────────────────────────────────────────────────────────────
  if (type === "tarot" || type.startsWith("tarot")) {
    const cards = (userPickedCards && userPickedCards.length === 3)
      ? userPickedCards
      : Array.from({ length: 3 }, () => TAROT_DECK[Math.floor(Math.random() * TAROT_DECK.length)]);
    const [past, present, future] = cards;
    const questionLine = question ? `\n질문: "${question}"` : "\n(전반적인 운세 리딩)";

    systemPrompt = `당신은 20년 경력의 타로 카드 전문 상담가입니다. 라이더-웨이트 타로 체계를 기반으로 해석하며, 각 카드의 수비학(Numerology), 원소(불·물·바람·흙), 아르카나 계열이 전달하는 에너지를 정밀하게 읽어냅니다. 상투적 위로나 막연한 긍정 대신, 카드가 실제로 보여주는 상황과 그에 대한 구체적 행동 지침을 제공합니다. 어두운 카드도 솔직하게 해석하되, 그 안에 담긴 기회와 전환점을 함께 짚어주세요.`;

    userPrompt = `타로 3장 스프레드를 리딩해주세요.${questionLine}

뽑힌 카드:
- 과거(뿌리/원인/씨앗): ${past}
- 현재(핵심 에너지/도전): ${present}
- 미래(방향/잠재적 결과): ${future}

해석 지침:
1. 각 카드가 해당 위치(과거/현재/미래)에서 갖는 의미를 구체적 상황으로 2-3문장 묘사 — 상징과 에너지를 현실 맥락과 연결하세요
2. 3장 카드 사이의 흐름과 인과관계를 이어 하나의 서사로 만드세요 (과거의 원인이 현재를 만들고, 현재의 선택이 미래를 결정한다는 관점)
3. 질문이 있다면 해당 질문에 대한 직접적이고 솔직한 답을 포함하세요
4. 각 카드마다 "지금 당장 할 수 있는" 구체적 행동 조언 1가지를 포함하세요
5. 행운 색상은 카드 원소(불=빨강/주황, 물=파랑/청록, 바람=노랑/흰색, 흙=초록/갈색)와 수비학에서 논리적으로 도출하세요

반드시 JSON 형식으로만 응답:
{"cards":[{"position":"과거","name":"${past}","meaning":"이 위치에서의 구체적 상황 묘사 2-3문장","advice":"지금 당장 실행 가능한 행동 조언"},{"position":"현재","name":"${present}","meaning":"이 위치에서의 구체적 상황 묘사 2-3문장","advice":"지금 당장 실행 가능한 행동 조언"},{"position":"미래","name":"${future}","meaning":"이 위치에서의 구체적 상황 묘사 2-3문장","advice":"지금 당장 실행 가능한 행동 조언"}],"overall":"3장의 인과적 흐름과 핵심 메시지를 담은 스토리텔링 3-4문장","luckyColor":"카드 원소·수비학 근거 색상","luckyNumber":7}`;

  // ── 사주 ──────────────────────────────────────────────────────────────────
  } else if (type.startsWith("saju") && birthDate) {
    const year = parseInt(birthDate.slice(0, 4));
    const month = parseInt(birthDate.slice(5, 7));
    const day = parseInt(birthDate.slice(8, 10));
    const timeHour = birthTime ? parseInt(birthTime.slice(0, 2)) : null;
    const sajuPeriod = type.split("_")[1] ?? "today";
    const periodLabel = sajuEnd
      ? `${sajuStart} ~ ${sajuEnd}`
      : sajuStart
        ? sajuStart
        : (sajuPeriod === "today" ? "오늘" : sajuPeriod === "month" ? "이번 달" : `${new Date().getFullYear()}년 전체`);

    const genderLabel = gender === "male" ? "남성" : gender === "female" ? "여성" : "미입력";
    const timeLabel = timeHour !== null ? `${timeHour}시 (${getShigan(timeHour)})` : "미입력";
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;

    systemPrompt = `당신은 30년 경력의 사주명리학 전문 상담가입니다. 음양오행(陰陽五行), 천간(天干), 지지(地支), 십신(十神), 육친(六親), 용신(用神), 격국(格局), 대운(大運), 세운(歲運) 이론을 정밀하게 활용합니다.
분석 원칙:
- 일간(日干)의 강약을 기반으로 모든 해석을 전개하세요
- "노력하면 된다", "좋은 일이 있을 것입니다", "긍정적으로 생각하세요" 같은 공허한 상투어를 절대 사용하지 마세요
- 오행 원리에 근거한 구체적이고 현실적인 조언을 제공하세요
- 길흉을 솔직하게 전달하되, 극복 방법과 구체적 실천 시점을 함께 제시하세요
- 각 분야(연애/재물/건강/직업)의 조언은 일간의 특성과 세운의 흐름을 반드시 연계하세요`;

    userPrompt = `다음 사주를 분석하여 ${periodLabel} 운세를 알려주세요.

[사주 정보]
- 성별: ${genderLabel}
- 생년월일: ${year}년 ${month}월 ${day}일 (양력)
- 출생시각: ${timeLabel}
- 현재 나이: 만 ${age}세
- 분석 기간: ${periodLabel}
- 오늘 날짜: ${date} (${getYearGanji(currentYear)}년)

[분석 지침]
1. 이 생년월일의 일간(日干)을 추정하고 핵심 기질을 파악하세요
2. 오행(목·화·토·금·수) 분포와 강약을 분석하세요
3. 용신(用神)이 무엇인지와 그 근거를 간략히 제시하세요
4. 현재 대운(大運)의 흐름 속에서 ${periodLabel}을 해석하세요
5. 분야별 구체적 운세를 일간 특성에 맞게 분석하세요:
   - 연애운: 육친(六親) 분석 기반, 현실적 상황 묘사
   - 재물운: 재성(財星) 흐름과 구체적 기회·주의점
   - 건강운: 약한 오행 기반 신체 부위·생활 조언
   - 직업/학업운: 관성(官星)·식상(食傷) 흐름과 방향
6. 행운 요소를 오행 원리에서 도출하세요

[출력 형식]
JSON으로 응답:
{"ilgan":"일간 추정 및 핵심 기질 1문장 (예: 갑목(甲木) - 성장하는 큰 나무 에너지)","oheng_summary":"오행 강약 및 용신 요약 1-2문장","overall":"${periodLabel} 전체 운세 흐름 3-4문장 (일간 특성과 세운 연계)","categories":{"연애운":"구체적 상황과 조언 2문장","재물운":"구체적 기회와 주의점 2문장","건강운":"오행 기반 건강 조언 2문장","직업/학업운":"방향과 시기 조언 2문장"},"luckyColor":"오행 용신에서 도출한 행운 색상","luckyNumber":3,"luckyDirection":"행운의 방향 (오행 기반)","luckyFood":"용신 오행에 맞는 음식","advice":"${periodLabel} 핵심 실천 조언 2문장","caution":"반드시 주의할 점 1문장"}`;

  // ── 일일 운세 ─────────────────────────────────────────────────────────────
  } else {
    const dayOfWeek = ["일","월","화","수","목","금","토"][new Date().getDay()];
    const currentYear = new Date().getFullYear();
    const genderLabel = gender === "male" ? "남성" : gender === "female" ? "여성" : null;
    const yearGanji = getYearGanji(currentYear);

    systemPrompt = `당신은 사주명리학과 동양 점술에 정통한 운세 전문 상담가입니다. 생년월일을 바탕으로 일간(日干)과 오행을 추정하여 오늘의 개인화된 운세를 분석합니다. "좋은 하루 되세요", "행복하세요" 같은 상투적 표현 없이, 오늘 하루 실제로 어떻게 행동하면 좋을지 구체적이고 실용적인 지침을 제공합니다. 주의사항도 솔직하게 전달하되 불안감이 아닌 대비책으로 표현하세요.`;

    const birthInfo = birthDate
      ? `\n- 생년월일: ${birthDate}${genderLabel ? ` (${genderLabel})` : ""}
- 생년 간지: ${getYearGanji(parseInt(birthDate.slice(0, 4)))}년생
- 일간(日干): 생년월일 기반으로 추정하여 활용`
      : "";

    userPrompt = `오늘의 하루 운세를 분석해주세요.

[정보]
- 오늘: ${date} ${dayOfWeek}요일 (${yearGanji}년)${birthInfo}

[분석 지침]
${birthDate
  ? `- 생년월일의 일간을 추정하여 오늘의 일진(日辰)과의 관계를 분석하세요
- 오늘 날짜의 간지와 생년의 간지가 어떻게 상호작용하는지 반영하세요`
  : `- 오늘 날짜의 일진(日辰)을 기반으로 전반적인 운세를 분석하세요`}
- 각 분야별 구체적인 하루 운세와 실용적 행동 지침을 제공하세요
- 긍정적이고 활기찬 톤이되, 주의사항도 솔직하게 포함하세요
- 럭키 아이템(색상, 숫자, 음식)은 오늘 일진의 오행에서 도출하세요

JSON으로 응답:
{"overall":"오늘 하루 전체 운세 2문장 (개인화된 내용)","score":85,"categories":{"love":"연애/인간관계 운세와 오늘의 tip","money":"재물/소비 운세와 오늘의 tip","health":"건강/컨디션 운세와 오늘의 tip","work":"직업/학업 운세와 오늘의 tip"},"luckyColor":"오늘 일진 오행의 행운 색상","luckyNumber":7,"luckyFood":"오늘 오행에 맞는 음식","advice":"오늘 하루를 잘 보내기 위한 핵심 한마디"}`;
  }

  try {
    const content = await geminiGenerateJson<object>(
      `${systemPrompt}\n\n---\n\n${userPrompt}`,
      { temperature: 0.85, maxOutputTokens: 1500 }
    );

    await prisma.fortuneCache.create({
      data: { userId: session.user.id, type, date, content },
    });

    return NextResponse.json({ ...content, cached: false, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("Fortune Gemini error:", e);
    return NextResponse.json({ error: "운세 생성 실패" }, { status: 500 });
  }
}

// 연도 간지 계산
function getYearGanji(year: number): string {
  const cheongan = ["갑","을","병","정","무","기","경","신","임","계"];
  const jiji = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
  const cg = cheongan[(year - 4) % 10];
  const jj = jiji[(year - 4) % 12];
  return `${cg}${jj}`;
}

// 시간대 → 시간(時) 이름
function getShigan(hour: number): string {
  const sigan = ["자시","자시","축시","축시","인시","인시","묘시","묘시","진시","진시","사시","사시","오시","오시","미시","미시","신시","신시","유시","유시","술시","술시","해시","해시"];
  return sigan[hour] ?? "";
}
