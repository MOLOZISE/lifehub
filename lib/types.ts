// ─── Study App Types ────────────────────────────────────────────────────────

export type SubjectColor =
  | "red" | "orange" | "yellow" | "green" | "blue" | "indigo" | "purple" | "pink";

export interface Subject {
  id: string;
  name: string;
  description: string;
  color: SubjectColor;
  emoji: string;
  examDate?: string;
  createdAt: string;
  updatedAt: string;
  lastStudiedAt?: string;
}

export interface Note {
  id: string;
  subjectId: string;
  title: string;
  content: string; // markdown
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type QuestionType = "multiple" | "ox" | "short";

export interface QuizQuestion {
  id: string;
  subjectId: string;
  type: QuestionType;
  question: string;
  options?: string[];   // for multiple choice
  answer: string;       // correct answer text
  explanation: string;
  tags: string[];
  wrongCount: number;
  lastAnsweredAt?: string;
  createdAt: string;
}

export interface QuizSession {
  id: string;
  subjectId: string;
  questionIds: string[];
  answers: string[];
  score: number;
  total: number;
  durationSeconds: number;
  completedAt: string;
}

export interface Flashcard {
  id: string;
  subjectId: string;
  front: string;
  back: string;
  tags: string[];
  interval: number;       // SM-2: days until next review
  easeFactor: number;     // SM-2: ease factor (default 2.5)
  nextReviewAt: string;   // ISO date
  reviewCount: number;
  known: boolean;
  createdAt: string;
}

export interface StudyLog {
  id: string;
  date: string; // YYYY-MM-DD
  subjectId: string;
  activityType: "note" | "quiz" | "flashcard" | "pomodoro" | "session";
  durationMinutes: number;
  count?: number;
  createdAt: string;
}

export interface DailyGoal {
  date: string;
  goals: { subjectId: string; targetMinutes: number; done: boolean }[];
  note?: string;
}

// ─── Exam Management ─────────────────────────────────────────────────────────

export type ExamStatus = "preparing" | "completed_pass" | "completed_fail" | "cancelled";

export interface Exam {
  id: string;
  name: string;           // e.g. "정보처리기사 필기"
  category: string;       // e.g. "자격증", "어학", "TOPCIT"
  examDate: string;       // YYYY-MM-DD
  targetScore?: number;   // target to achieve e.g. 80
  passScore?: number;     // minimum passing score e.g. 60
  subjectIds: string[];   // linked subject IDs
  memo?: string;
  status: ExamStatus;
  actualScore?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Rich Study Session ──────────────────────────────────────────────────────

export type SessionActivityType =
  | "reading"
  | "problem_solving"
  | "review"
  | "quiz"
  | "flashcard"
  | "lecture"
  | "pomodoro"
  | "writing";

export interface StudySession {
  id: string;
  date: string;                 // YYYY-MM-DD
  subjectId: string;
  examId?: string;
  materialName?: string;        // what material/resource was used
  activityType: SessionActivityType;
  durationMinutes: number;
  pagesOrQuestions?: number;    // pages covered or questions attempted
  correctRate?: number;         // 0-100 if applicable
  focusScore: number;           // 1-5
  fatigueScore: number;         // 1-5
  satisfactionScore: number;    // 1-5
  memo?: string;
  createdAt: string;
}

// ─── Wrong Answer Notes ──────────────────────────────────────────────────────

export type WrongReason =
  | "concept_gap"     // 개념 미숙
  | "memory_gap"      // 암기 부족
  | "careless"        // 실수
  | "time_pressure"   // 시간 부족
  | "confusion";      // 헷갈림

export interface WrongAnswerNote {
  id: string;
  subjectId: string;
  examId?: string;
  questionText: string;
  myAnswer?: string;
  correctAnswer: string;
  explanation?: string;
  reason: WrongReason;
  tags: string[];
  reviewCount: number;
  lastReviewedAt?: string;
  nextReviewAt: string;   // spaced repetition next date (YYYY-MM-DD)
  resolved: boolean;
  createdAt: string;
}

// ─── Recommendation Engine ───────────────────────────────────────────────────

export type RecommendationType =
  | "review_wrong_answers"
  | "study_weak_subject"
  | "take_mock_test"
  | "adjust_schedule"
  | "exam_approaching"
  | "maintain_streak"
  | "reduce_fatigue";

export interface StudyRecommendation {
  id: string;
  type: RecommendationType;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  subjectId?: string;
  examId?: string;
  daysUntilExam?: number;
  actionLabel?: string;
  actionHref?: string;
  generatedAt: string;
}

// ─── Portfolio App Types ─────────────────────────────────────────────────────

export type PortfolioSector =
  | "tech"
  | "semiconductor"
  | "finance"
  | "healthcare"
  | "energy"
  | "consumer"
  | "industrial"
  | "materials"
  | "real_estate"
  | "utilities"
  | "communication"
  | "etf"
  | "other";

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  market: "KR" | "US";
  sector?: PortfolioSector;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currency: "KRW" | "USD";
  memo?: string;
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StrategyMemo {
  id: string;
  ticker: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  market: "KR" | "US";
  sector?: PortfolioSector;
  currency: "KRW" | "USD";
  currentPrice: number;
  targetPrice?: number;
  alertCondition?: string;
  memo?: string;
  addedAt: string;
}

// ─── Portfolio Risk ───────────────────────────────────────────────────────────

export interface PortfolioRisk {
  topHoldingConcentration: number;    // % of largest single holding
  sectorConcentration: number;        // % of largest sector
  dominantSector?: PortfolioSector;
  marketConcentration: { KR: number; US: number };
  highConcentrationWarning: boolean;
  diversificationScore: number;       // 0-100
  riskLevel: "low" | "medium" | "high";
  warnings: string[];
}

// ─── Study AI Types ──────────────────────────────────────────────────────────

export type SourceType = "text" | "note";

export interface StudySource {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  type: SourceType;
  createdAt: string;
  updatedAt: string;
}
