import { getItem, setItem } from "./base";
import type {
  Subject, Note, QuizQuestion, QuizSession, Flashcard,
  StudyLog, DailyGoal, StudySource,
  Exam, StudySession, WrongAnswerNote,
} from "../types";

// Subjects
export function getSubjects(): Subject[] { return getItem<Subject[]>("subjects", []); }
export function saveSubjects(s: Subject[]): void { setItem("subjects", s); }
export function getSubjectById(id: string): Subject | undefined { return getSubjects().find(s => s.id === id); }

// Notes
export function getNotes(subjectId: string): Note[] { return getItem<Note[]>(`notes_${subjectId}`, []); }
export function saveNotes(subjectId: string, notes: Note[]): void { setItem(`notes_${subjectId}`, notes); }

// Quiz
export function getQuestions(subjectId: string): QuizQuestion[] { return getItem<QuizQuestion[]>(`questions_${subjectId}`, []); }
export function saveQuestions(subjectId: string, q: QuizQuestion[]): void { setItem(`questions_${subjectId}`, q); }
export function getSessions(subjectId: string): QuizSession[] { return getItem<QuizSession[]>(`sessions_${subjectId}`, []); }
export function saveSessions(subjectId: string, s: QuizSession[]): void { setItem(`sessions_${subjectId}`, s); }

// Flashcards
export function getFlashcards(subjectId: string): Flashcard[] { return getItem<Flashcard[]>(`flashcards_${subjectId}`, []); }
export function saveFlashcards(subjectId: string, cards: Flashcard[]): void { setItem(`flashcards_${subjectId}`, cards); }

// Study logs (legacy + session-based)
export function getStudyLogs(date?: string): StudyLog[] {
  const all = getItem<StudyLog[]>("study-logs", []);
  return date ? all.filter(l => l.date === date) : all;
}
export function saveStudyLog(log: StudyLog): void {
  const all = getItem<StudyLog[]>("study-logs", []);
  setItem("study-logs", [...all, log]);
}

// Study sources (for AI quiz generation)
export function getSources(subjectId: string): StudySource[] { return getItem<StudySource[]>(`sources_${subjectId}`, []); }
export function saveSources(subjectId: string, sources: StudySource[]): void { setItem(`sources_${subjectId}`, sources); }

// Daily goals
export function getDailyGoal(date: string): DailyGoal | null { return getItem<DailyGoal | null>(`daily-goal_${date}`, null); }
export function saveDailyGoal(goal: DailyGoal): void { setItem(`daily-goal_${goal.date}`, goal); }

// ─── Exams ────────────────────────────────────────────────────────────────────

export function getExams(): Exam[] { return getItem<Exam[]>("exams", []); }
export function saveExams(exams: Exam[]): void { setItem("exams", exams); }
export function getExamById(id: string): Exam | undefined { return getExams().find(e => e.id === id); }

export function upsertExam(exam: Exam): void {
  const all = getExams();
  const idx = all.findIndex(e => e.id === exam.id);
  if (idx >= 0) { all[idx] = exam; } else { all.push(exam); }
  saveExams(all);
}

export function deleteExam(id: string): void {
  saveExams(getExams().filter(e => e.id !== id));
}

// ─── Study Sessions (rich) ───────────────────────────────────────────────────

export function getStudySessions(date?: string): StudySession[] {
  const all = getItem<StudySession[]>("study-sessions", []);
  return date ? all.filter(s => s.date === date) : all;
}

export function getStudySessionsBySubject(subjectId: string): StudySession[] {
  return getItem<StudySession[]>("study-sessions", []).filter(s => s.subjectId === subjectId);
}

export function saveStudySession(session: StudySession): void {
  const all = getItem<StudySession[]>("study-sessions", []);
  const idx = all.findIndex(s => s.id === session.id);
  if (idx >= 0) { all[idx] = session; } else { all.push(session); }
  setItem("study-sessions", all);
  // Also log to legacy study-logs for backward compat
  const log: StudyLog = {
    id: session.id,
    date: session.date,
    subjectId: session.subjectId,
    activityType: "session",
    durationMinutes: session.durationMinutes,
    createdAt: session.createdAt,
  };
  const logs = getItem<StudyLog[]>("study-logs", []);
  if (!logs.find(l => l.id === session.id)) {
    setItem("study-logs", [...logs, log]);
  }
}

export function deleteStudySession(id: string): void {
  const all = getItem<StudySession[]>("study-sessions", []);
  setItem("study-sessions", all.filter(s => s.id !== id));
  const logs = getItem<StudyLog[]>("study-logs", []);
  setItem("study-logs", logs.filter(l => l.id !== id));
}

// ─── Wrong Answer Notes ──────────────────────────────────────────────────────

export function getWrongAnswerNotes(subjectId?: string): WrongAnswerNote[] {
  const all = getItem<WrongAnswerNote[]>("wrong-answers", []);
  return subjectId ? all.filter(w => w.subjectId === subjectId) : all;
}

export function saveWrongAnswerNote(note: WrongAnswerNote): void {
  const all = getItem<WrongAnswerNote[]>("wrong-answers", []);
  const idx = all.findIndex(w => w.id === note.id);
  if (idx >= 0) { all[idx] = note; } else { all.push(note); }
  setItem("wrong-answers", all);
}

export function deleteWrongAnswerNote(id: string): void {
  setItem("wrong-answers", getItem<WrongAnswerNote[]>("wrong-answers", []).filter(w => w.id !== id));
}

// ─── Analytics helpers ────────────────────────────────────────────────────────

/** Total study minutes per subject over the last N days */
export function getSubjectStudyMinutes(days: number): Record<string, number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const sessions = getStudySessions().filter(s => s.date >= cutoffStr);
  const logs = getStudyLogs().filter(l => l.date >= cutoffStr && l.activityType !== "session");

  const result: Record<string, number> = {};

  sessions.forEach(s => {
    result[s.subjectId] = (result[s.subjectId] ?? 0) + s.durationMinutes;
  });
  logs.forEach(l => {
    if (!result[l.subjectId]) {
      result[l.subjectId] = (result[l.subjectId] ?? 0) + l.durationMinutes;
    }
  });

  return result;
}

/** Average focus score per subject over recent sessions */
export function getSubjectAvgFocus(subjectId: string, days = 14): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const sessions = getStudySessions().filter(
    s => s.subjectId === subjectId && s.date >= cutoffStr
  );
  if (sessions.length === 0) return 0;
  return sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length;
}

/** Count pending wrong answer reviews due today or before */
export function getDueWrongAnswers(): WrongAnswerNote[] {
  const today = new Date().toISOString().slice(0, 10);
  return getWrongAnswerNotes().filter(w => !w.resolved && w.nextReviewAt <= today);
}

// ─── Data export/import ───────────────────────────────────────────────────────

export function exportAllData(): string {
  const keys = Object.keys(localStorage);
  const data: Record<string, unknown> = {};
  keys.forEach(k => { try { data[k] = JSON.parse(localStorage.getItem(k)!); } catch { data[k] = localStorage.getItem(k); } });
  return JSON.stringify(data, null, 2);
}

export function importAllData(json: string): void {
  const data = JSON.parse(json) as Record<string, unknown>;
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
}
