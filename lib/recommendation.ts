/**
 * Rule-based study recommendation engine.
 * Analyzes study data and generates actionable recommendations.
 */

import type { StudyRecommendation, Exam, Subject, WrongAnswerNote } from "./types";
import {
  getSubjects,
  getExams,
  getStudySessions,
  getStudyLogs,
  getWrongAnswerNotes,
  getDueWrongAnswers,
  getSubjectStudyMinutes,
  getFlashcards,
} from "./storage";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date(today()).getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Individual rule functions ────────────────────────────────────────────────

function checkExamApproaching(exams: Exam[]): StudyRecommendation[] {
  const recs: StudyRecommendation[] = [];
  const active = exams.filter(e => e.status === "preparing" && e.examDate >= today());

  for (const exam of active) {
    const days = daysUntil(exam.examDate);

    if (days <= 7 && days >= 0) {
      recs.push({
        id: makeId(),
        type: "exam_approaching",
        priority: "high",
        title: `⚠️ ${exam.name} D-${days}`,
        description: `시험이 ${days}일 남았습니다. 오답 복습과 실전 모의 풀이에 집중하세요.`,
        examId: exam.id,
        daysUntilExam: days,
        actionLabel: "시험 관리",
        actionHref: "/study/exams",
        generatedAt: new Date().toISOString(),
      });
    } else if (days <= 30 && days > 7) {
      recs.push({
        id: makeId(),
        type: "exam_approaching",
        priority: "medium",
        title: `📅 ${exam.name} D-${days}`,
        description: `시험까지 ${days}일 남았습니다. 취약 영역 보완과 복습 주기를 확인하세요.`,
        examId: exam.id,
        daysUntilExam: days,
        actionLabel: "시험 관리",
        actionHref: "/study/exams",
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return recs;
}

function checkDueWrongAnswers(): StudyRecommendation[] {
  const due = getDueWrongAnswers();
  if (due.length === 0) return [];

  const subjectCounts: Record<string, number> = {};
  due.forEach(w => {
    subjectCounts[w.subjectId] = (subjectCounts[w.subjectId] ?? 0) + 1;
  });

  const topSubjectId = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const subjects = getSubjects();
  const topSubject = subjects.find(s => s.id === topSubjectId);

  return [{
    id: makeId(),
    type: "review_wrong_answers",
    priority: due.length >= 10 ? "high" : "medium",
    title: `오답 복습 ${due.length}개 대기 중`,
    description: topSubject
      ? `${topSubject.emoji} ${topSubject.name} 포함 ${due.length}개의 오답 복습이 예정되어 있습니다. 지금 바로 복습하세요.`
      : `${due.length}개의 오답 복습이 예정되어 있습니다.`,
    subjectId: topSubjectId,
    actionLabel: "오답 복습",
    actionHref: "/study/wrong-answers",
    generatedAt: new Date().toISOString(),
  }];
}

function checkNeglectedSubjects(exams: Exam[], subjects: Subject[]): StudyRecommendation[] {
  const recs: StudyRecommendation[] = [];
  const minutesBySubject = getSubjectStudyMinutes(14);
  const totalMin = Object.values(minutesBySubject).reduce((a, b) => a + b, 0);

  // Find subjects linked to active exams that have very low study time
  const activeExams = exams.filter(e => e.status === "preparing" && e.examDate >= today());

  for (const exam of activeExams) {
    const examSubjects = subjects.filter(s => exam.subjectIds.includes(s.id));
    if (examSubjects.length === 0) continue;

    // Find the most neglected subject
    const withTime = examSubjects.map(s => ({
      subject: s,
      minutes: minutesBySubject[s.id] ?? 0,
    }));

    withTime.sort((a, b) => a.minutes - b.minutes);
    const weakest = withTime[0];
    const average = totalMin / Math.max(examSubjects.length, 1);

    if (weakest.minutes < average * 0.5 && weakest.minutes < 60) {
      recs.push({
        id: makeId(),
        type: "study_weak_subject",
        priority: "medium",
        title: `${weakest.subject.emoji} ${weakest.subject.name} 학습 부족`,
        description: `최근 2주간 ${weakest.subject.name} 학습 시간이 ${weakest.minutes}분으로 다른 과목 대비 크게 부족합니다. 오늘 최소 30분 이상 보완하세요.`,
        subjectId: weakest.subject.id,
        examId: exam.id,
        actionLabel: "과목 이동",
        actionHref: `/study/subjects/${weakest.subject.id}`,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return recs;
}

function checkStudyStreak(): StudyRecommendation[] {
  const allLogs = getStudyLogs();
  const allSessions = getStudySessions();

  const studiedDates = new Set([
    ...allLogs.map(l => l.date),
    ...allSessions.map(s => s.date),
  ]);

  // Check last 3 days
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 30; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    if (studiedDates.has(dateStr)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Check if studied today
  const studiedToday = studiedDates.has(today());

  if (!studiedToday) {
    const lastStudyDate = [...studiedDates].sort().reverse()[0];
    const daysSince = lastStudyDate ? daysUntil(lastStudyDate) * -1 : 999;

    if (daysSince >= 2) {
      return [{
        id: makeId(),
        type: "maintain_streak",
        priority: "medium",
        title: `${daysSince}일간 학습 기록 없음`,
        description: `최근 ${daysSince}일간 학습 기록이 없습니다. 짧더라도 오늘 학습 세션을 기록해보세요.`,
        actionLabel: "세션 기록",
        actionHref: "/study/sessions",
        generatedAt: new Date().toISOString(),
      }];
    }
  }

  if (streak >= 7) {
    return [{
      id: makeId(),
      type: "maintain_streak",
      priority: "low",
      title: `🔥 ${streak}일 연속 학습 중!`,
      description: `훌륭합니다! ${streak}일 연속 학습을 유지하고 있습니다. 오늘도 이어가세요.`,
      actionLabel: "오늘 학습",
      actionHref: "/study/sessions",
      generatedAt: new Date().toISOString(),
    }];
  }

  return [];
}

function checkHighFatigue(): StudyRecommendation[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recentSessions = getStudySessions().filter(s => s.date >= cutoffStr);
  if (recentSessions.length < 3) return [];

  const avgFatigue = recentSessions.reduce((sum, s) => sum + s.fatigueScore, 0) / recentSessions.length;
  const avgSatisfaction = recentSessions.reduce((sum, s) => sum + s.satisfactionScore, 0) / recentSessions.length;

  if (avgFatigue >= 4 && avgSatisfaction <= 2) {
    return [{
      id: makeId(),
      type: "reduce_fatigue",
      priority: "medium",
      title: "⚡ 최근 피로도 높음",
      description: `최근 3일 평균 피로도 ${avgFatigue.toFixed(1)}/5, 만족도 ${avgSatisfaction.toFixed(1)}/5입니다. 학습 강도를 줄이거나 방법을 바꿔보세요.`,
      actionLabel: "학습 분석",
      actionHref: "/study/analytics",
      generatedAt: new Date().toISOString(),
    }];
  }

  return [];
}

function checkFlashcardsDue(subjects: Subject[]): StudyRecommendation[] {
  let totalDue = 0;
  const todayStr = today();

  subjects.forEach(s => {
    const cards = getFlashcards(s.id);
    totalDue += cards.filter(c => c.nextReviewAt.slice(0, 10) <= todayStr).length;
  });

  if (totalDue >= 10) {
    return [{
      id: makeId(),
      type: "review_wrong_answers",
      priority: totalDue >= 20 ? "high" : "medium",
      title: `플래시카드 ${totalDue}장 복습 대기`,
      description: `${totalDue}장의 플래시카드 복습 시간이 됐습니다. 간격 반복의 효과를 놓치지 마세요.`,
      actionLabel: "과목 목록",
      actionHref: "/study/subjects",
      generatedAt: new Date().toISOString(),
    }];
  }

  return [];
}

// ─── Main recommendation generator ───────────────────────────────────────────

export function generateStudyRecommendations(): StudyRecommendation[] {
  const subjects = getSubjects();
  const exams = getExams();

  const all: StudyRecommendation[] = [
    ...checkExamApproaching(exams),
    ...checkDueWrongAnswers(),
    ...checkNeglectedSubjects(exams, subjects),
    ...checkStudyStreak(),
    ...checkHighFatigue(),
    ...checkFlashcardsDue(subjects),
  ];

  // Sort by priority: high → medium → low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  all.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return all.slice(0, 5); // max 5 recommendations
}

// ─── Portfolio risk analysis ──────────────────────────────────────────────────

import type { Holding, PortfolioRisk, PortfolioSector } from "./types";

export function analyzePortfolioRisk(holdings: Holding[]): PortfolioRisk {
  if (holdings.length === 0) {
    return {
      topHoldingConcentration: 0,
      sectorConcentration: 0,
      marketConcentration: { KR: 0, US: 0 },
      highConcentrationWarning: false,
      diversificationScore: 100,
      riskLevel: "low",
      warnings: [],
    };
  }

  const KRW_TO_USD = 1350;
  const toUSD = (h: Holding) => {
    const v = h.quantity * h.currentPrice;
    return h.currency === "KRW" ? v / KRW_TO_USD : v;
  };

  const totalUSD = holdings.reduce((s, h) => s + toUSD(h), 0);
  if (totalUSD === 0) {
    return {
      topHoldingConcentration: 0,
      sectorConcentration: 0,
      marketConcentration: { KR: 0, US: 0 },
      highConcentrationWarning: false,
      diversificationScore: 100,
      riskLevel: "low",
      warnings: [],
    };
  }

  // Top holding concentration
  const holdingWeights = holdings.map(h => toUSD(h) / totalUSD * 100);
  const topHoldingConcentration = Math.max(...holdingWeights);

  // Sector concentration
  const sectorWeights: Record<string, number> = {};
  holdings.forEach(h => {
    const sector = h.sector ?? "other";
    sectorWeights[sector] = (sectorWeights[sector] ?? 0) + toUSD(h) / totalUSD * 100;
  });
  const sectorEntries = Object.entries(sectorWeights).sort((a, b) => b[1] - a[1]);
  const sectorConcentration = sectorEntries[0]?.[1] ?? 0;
  const dominantSector = sectorEntries[0]?.[0] as PortfolioSector | undefined;

  // Market concentration
  const krUSD = holdings.filter(h => h.market === "KR").reduce((s, h) => s + toUSD(h), 0);
  const usUSD = holdings.filter(h => h.market === "US").reduce((s, h) => s + toUSD(h), 0);
  const marketConcentration = {
    KR: Math.round(krUSD / totalUSD * 100),
    US: Math.round(usUSD / totalUSD * 100),
  };

  // Diversification score (0-100, higher = more diversified)
  let score = 100;
  if (topHoldingConcentration > 50) score -= 30;
  else if (topHoldingConcentration > 30) score -= 15;
  if (sectorConcentration > 60) score -= 25;
  else if (sectorConcentration > 40) score -= 10;
  if (holdings.length < 3) score -= 20;
  else if (holdings.length < 5) score -= 10;
  if (marketConcentration.KR > 80 || marketConcentration.US > 80) score -= 10;
  score = Math.max(0, Math.min(100, score));

  // Warnings
  const warnings: string[] = [];
  if (topHoldingConcentration > 50) {
    const top = holdings.find(h => toUSD(h) / totalUSD * 100 === topHoldingConcentration);
    warnings.push(`단일 종목(${top?.name ?? ""}) 집중도 ${topHoldingConcentration.toFixed(0)}% — 분산 필요`);
  }
  if (sectorConcentration > 60 && dominantSector) {
    const sectorLabel: Record<string, string> = {
      tech: "IT/기술", semiconductor: "반도체", finance: "금융", healthcare: "헬스케어",
      energy: "에너지", consumer: "소비재", industrial: "산업재", materials: "소재",
      real_estate: "부동산", utilities: "유틸리티", communication: "통신", etf: "ETF", other: "기타",
    };
    warnings.push(`${sectorLabel[dominantSector] ?? dominantSector} 섹터 집중도 ${sectorConcentration.toFixed(0)}% — 섹터 리스크 주의`);
  }
  if (holdings.length < 3) {
    warnings.push(`보유 종목 ${holdings.length}개 — 추가 분산 투자 권장`);
  }
  if (marketConcentration.US > 80) {
    warnings.push(`미국 주식 비중 ${marketConcentration.US}% — 환율 리스크 노출`);
  }
  if (marketConcentration.KR > 80) {
    warnings.push(`한국 주식 비중 ${marketConcentration.KR}% — 국내 리스크 집중`);
  }

  const highConcentrationWarning = topHoldingConcentration > 50 || sectorConcentration > 60;

  let riskLevel: "low" | "medium" | "high" = "low";
  if (score < 40) riskLevel = "high";
  else if (score < 70) riskLevel = "medium";

  return {
    topHoldingConcentration,
    sectorConcentration,
    dominantSector,
    marketConcentration,
    highConcentrationWarning,
    diversificationScore: score,
    riskLevel,
    warnings,
  };
}
