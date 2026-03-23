// 학습 활동 타입 — 세 페이지(sessions, subjects, subjects/[id]) 공통 사용
export const ACTIVITY_LABELS: Record<string, string> = {
  reading:         "📖 읽기/독해",
  lecture:         "🎓 강의",
  problem_solving: "✏️ 문제풀이",
  problem:         "✏️ 문제풀이",   // 구버전 호환
  review:          "🔄 복습",
  quiz:            "🧩 퀴즈",
  flashcard:       "🃏 플래시카드",
  pomodoro:        "🍅 뽀모도로",
  writing:         "✍️ 필기/정리",
  other:           "📝 기타",
};

// Select 드롭다운에 노출할 항목 (구버전 호환 key 제외)
export const ACTIVITY_OPTIONS = [
  { value: "reading",         label: "📖 읽기/독해"   },
  { value: "lecture",         label: "🎓 강의"        },
  { value: "problem_solving", label: "✏️ 문제풀이"    },
  { value: "review",          label: "🔄 복습"        },
  { value: "quiz",            label: "🧩 퀴즈"        },
  { value: "flashcard",       label: "🃏 플래시카드"  },
  { value: "pomodoro",        label: "🍅 뽀모도로"    },
  { value: "writing",         label: "✍️ 필기/정리"   },
  { value: "other",           label: "📝 기타"        },
] as const;
