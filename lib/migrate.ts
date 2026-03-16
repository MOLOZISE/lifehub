/**
 * localStorage → DB 마이그레이션 유틸리티
 * 로그인 후 최초 1회 실행하여 기존 데이터를 DB로 이전합니다.
 *
 * 사용법:
 *   import { migrateLocalStorageToDB } from "@/lib/migrate";
 *   await migrateLocalStorageToDB(userId);
 */

import { getItem } from "./storage/base";
import type {
  Subject, Note, QuizQuestion, QuizSession, Flashcard,
  StudyLog, DailyGoal, Exam, StudySession, WrongAnswerNote,
  StudySource, Holding, WatchlistGroup, WatchlistItem, StrategyMemo,
} from "./types";

const MIGRATION_FLAG = "lifehub_migrated_v1";

export async function migrateLocalStorageToDB(userId: string): Promise<{ success: boolean; message: string }> {
  if (typeof window === "undefined") return { success: false, message: "서버에서 실행 불가" };

  // 이미 마이그레이션한 경우 스킵
  if (localStorage.getItem(MIGRATION_FLAG) === userId) {
    return { success: true, message: "이미 마이그레이션 완료" };
  }

  try {
    const payload = collectLocalStorageData();

    // 데이터가 없으면 스킵
    const hasData =
      payload.subjects.length > 0 ||
      payload.holdings.length > 0 ||
      payload.exams.length > 0;

    if (!hasData) {
      localStorage.setItem(MIGRATION_FLAG, userId);
      return { success: true, message: "마이그레이션할 데이터 없음" };
    }

    const res = await fetch("/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, message: err.error ?? "마이그레이션 실패" };
    }

    localStorage.setItem(MIGRATION_FLAG, userId);
    return { success: true, message: "마이그레이션 완료" };
  } catch (e) {
    return { success: false, message: String(e) };
  }
}

function collectLocalStorageData() {
  const subjects = getItem<Subject[]>("subjects", []);

  // 과목별 데이터 수집
  const notes: Note[] = [];
  const questions: QuizQuestion[] = [];
  const quizSessions: QuizSession[] = [];
  const flashcards: Flashcard[] = [];
  const sources: StudySource[] = [];

  for (const subject of subjects) {
    notes.push(...getItem<Note[]>(`notes_${subject.id}`, []));
    questions.push(...getItem<QuizQuestion[]>(`questions_${subject.id}`, []));
    quizSessions.push(...getItem<QuizSession[]>(`sessions_${subject.id}`, []));
    flashcards.push(...getItem<Flashcard[]>(`flashcards_${subject.id}`, []));
    sources.push(...getItem<StudySource[]>(`sources_${subject.id}`, []));
  }

  const studyLogs = getItem<StudyLog[]>("study-logs", []);
  const studySessions = getItem<StudySession[]>("study-sessions", []);
  const wrongAnswers = getItem<WrongAnswerNote[]>("wrong-answers", []);
  const exams = getItem<Exam[]>("exams", []);

  // 일별 목표 (지난 90일)
  const dailyGoals: DailyGoal[] = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const goal = getItem<DailyGoal | null>(`daily-goal_${dateStr}`, null);
    if (goal) dailyGoals.push(goal);
  }

  // 포트폴리오
  const holdings = getItem<Holding[]>("holdings", []).filter(
    (h) => !["1", "2", "3", "4", "5"].includes(h.id) // 기본 샘플 데이터 제외
  );
  const watchlistGroups = getItem<WatchlistGroup[]>("watchlist-groups", []);
  const watchlistItems = getItem<WatchlistItem[]>("watchlist", []);
  const strategyMemos = getItem<StrategyMemo[]>("strategy-memos", []);

  return {
    subjects, notes, questions, quizSessions, flashcards, sources,
    studyLogs, studySessions, wrongAnswers, exams, dailyGoals,
    holdings, watchlistGroups, watchlistItems, strategyMemos,
  };
}

export function isMigrated(userId: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MIGRATION_FLAG) === userId;
}
