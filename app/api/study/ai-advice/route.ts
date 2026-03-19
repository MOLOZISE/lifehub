import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // force 파라미터는 향후 캐싱 시 사용 (현재는 항상 새로 생성)
  await req.json().catch(() => ({}));
  const userId = session.user.id;

  // 최근 30일 세션 데이터 가져오기
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const [sessions, subjects] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId, date: { gte: thirtyDaysAgoStr } },
      orderBy: { date: "desc" },
    }),
    prisma.subject.findMany({ where: { userId } }),
  ]);

  if (sessions.length === 0) {
    return NextResponse.json({
      advice: "아직 학습 기록이 없습니다. 학습을 시작해보세요!",
      sections: [],
      generatedAt: new Date().toISOString(),
    });
  }

  // 데이터 집계
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]));

  // 과목별 통계
  const subjectStats: Record<
    string,
    { minutes: number; sessions: number; totalFocus: number }
  > = {};
  let totalMinutes = 0;
  let totalFocus = 0;

  for (const s of sessions) {
    if (!subjectStats[s.subjectId])
      subjectStats[s.subjectId] = { minutes: 0, sessions: 0, totalFocus: 0 };
    subjectStats[s.subjectId].minutes += s.durationMinutes;
    subjectStats[s.subjectId].sessions += 1;
    subjectStats[s.subjectId].totalFocus += s.focusScore;
    totalMinutes += s.durationMinutes;
    totalFocus += s.focusScore;
  }

  const subjectAvgFocus: Record<
    string,
    { minutes: number; sessions: number; avgFocus: number }
  > = {};
  for (const [k, v] of Object.entries(subjectStats)) {
    subjectAvgFocus[k] = {
      minutes: v.minutes,
      sessions: v.sessions,
      avgFocus: Math.round(v.totalFocus / v.sessions),
    };
  }

  // 요일별 패턴
  const dayStats: Record<number, number> = {};
  for (const s of sessions) {
    const day = new Date(s.date).getDay();
    dayStats[day] = (dayStats[day] ?? 0) + s.durationMinutes;
  }

  const subjectSummary = Object.entries(subjectAvgFocus)
    .map(
      ([id, stat]) =>
        `- ${subjectMap[id] ?? id}: ${stat.minutes}분 (${stat.sessions}회, 집중도 ${stat.avgFocus}/5)`
    )
    .join("\n");

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayPattern = Object.entries(dayStats)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([d, m]) => `${dayNames[Number(d)]}요일: ${m}분`)
    .join(", ");

  const avgFocusOverall =
    sessions.length > 0 ? Math.round(totalFocus / sessions.length) : 0;

  const prompt = `당신은 전문 학습 코치입니다. 다음 최근 30일 학습 데이터를 분석하고 구체적이고 실용적인 조언을 제공하세요.

[학습 데이터]
- 총 학습 시간: ${totalMinutes}분 (${(totalMinutes / 60).toFixed(1)}시간)
- 평균 집중도: ${avgFocusOverall}/5
- 세션 수: ${sessions.length}회

[과목별 학습 현황]
${subjectSummary}

[요일별 패턴]
${dayPattern}

다음 형식으로 분석해주세요:

## 강점
현재 잘하고 있는 점 2-3가지

## 개선 포인트
구체적으로 개선이 필요한 부분 2-3가지

## 이번 주 추천 학습 계획
요일별 구체적인 실행 계획

## 집중도 향상 팁
데이터 기반의 맞춤 조언

각 항목은 간결하게 2-3문장으로 작성하세요.`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
    const chat = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1200,
    });

    const text = chat.choices[0]?.message?.content ?? "";

    // 섹션 파싱
    const sections = text
      .split(/^## /m)
      .filter(Boolean)
      .map((part) => {
        const lines = part.trim().split("\n");
        return {
          title: lines[0].trim(),
          content: lines.slice(1).join("\n").trim(),
        };
      });

    return NextResponse.json({
      advice: text,
      sections,
      totalMinutes,
      avgFocus: avgFocusOverall,
      sessionCount: sessions.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `AI 분석 실패: ${String(e)}` },
      { status: 500 }
    );
  }
}
