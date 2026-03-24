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

  // 집중도 트렌드 계산 (전반부 vs 후반부 15일 비교)
  const recentSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.floor(recentSessions.length / 2);
  const firstHalf = recentSessions.slice(0, half);
  const secondHalf = recentSessions.slice(half);
  const firstAvgFocus = firstHalf.length > 0 ? firstHalf.reduce((s, r) => s + r.focusScore, 0) / firstHalf.length : 0;
  const secondAvgFocus = secondHalf.length > 0 ? secondHalf.reduce((s, r) => s + r.focusScore, 0) / secondHalf.length : 0;
  const focusTrend = secondAvgFocus > firstAvgFocus + 0.3 ? "상승" : secondAvgFocus < firstAvgFocus - 0.3 ? "하락" : "유지";

  // 가장 집중도 높은 요일
  const dayFocusMap: Record<number, { total: number; count: number }> = {};
  for (const s of sessions) {
    const day = new Date(s.date).getDay();
    if (!dayFocusMap[day]) dayFocusMap[day] = { total: 0, count: 0 };
    dayFocusMap[day].total += s.focusScore;
    dayFocusMap[day].count += 1;
  }
  const bestDay = Object.entries(dayFocusMap).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))[0];
  const bestDayLabel = bestDay ? `${dayNames[Number(bestDay[0])]}요일 (평균 집중도 ${(bestDay[1].total / bestDay[1].count).toFixed(1)}/5)` : "데이터 없음";

  const prompt = `당신은 데이터 기반 학습 코치입니다. 아래 30일 학습 통계를 심층 분석하고 실행 가능한 맞춤 조언을 제공하세요.

[30일 종합 통계]
- 총 학습 시간: ${totalMinutes}분 (${(totalMinutes / 60).toFixed(1)}시간 / 일평균 ${(totalMinutes / 30).toFixed(0)}분)
- 평균 집중도: ${avgFocusOverall}/5
- 총 세션 수: ${sessions.length}회 (평균 ${(totalMinutes / Math.max(sessions.length, 1)).toFixed(0)}분/세션)
- 집중도 트렌드: 최근 15일이 이전 15일 대비 ${focusTrend} 중 (${firstAvgFocus.toFixed(1)} → ${secondAvgFocus.toFixed(1)})
- 최고 집중 요일: ${bestDayLabel}

[과목별 현황]
${subjectSummary}

[요일별 학습량]
${dayPattern}

다음 형식으로 분석하세요. 각 항목은 데이터를 직접 인용하며 구체적으로 작성하세요:

## 강점
데이터에서 확인된 잘하고 있는 점 2-3가지 (수치 포함)

## 개선 포인트
데이터가 보여주는 문제점과 구체적 개선 방법 2-3가지

## 이번 주 추천 학습 계획
현재 패턴을 반영한 요일별 실행 계획 (학습 시간·과목 배분 포함)

## 집중도 향상 전략
집중도 트렌드와 요일 패턴을 기반으로 한 맞춤 전략 2가지

각 항목은 2-3문장으로 간결하게 작성하세요. "열심히 하세요" 같은 추상적 격려 대신 구체적 수치와 방법론을 제시하세요.`;

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
