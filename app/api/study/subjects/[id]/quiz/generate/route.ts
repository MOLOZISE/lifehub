import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const count: number = Math.min(body.count ?? 5, 15);

  // Fetch subject + notes + flashcards as context
  const [subject, notes, flashcards] = await Promise.all([
    prisma.subject.findUnique({ where: { id, userId: session.user.id } }),
    prisma.note.findMany({ where: { subjectId: id, userId: session.user.id }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.flashcard.findMany({ where: { subjectId: id, userId: session.user.id }, take: 30 }),
  ]);

  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const notesText = notes.map(n => `[노트] ${n.title}\n${n.content}`).join("\n\n");
  const cardsText = flashcards.map(c => `Q: ${c.front}\nA: ${c.back}`).join("\n");
  const context = [notesText, cardsText].filter(Boolean).join("\n\n---\n\n");

  if (!context.trim()) {
    return NextResponse.json({ error: "노트나 플래시카드가 없습니다. 먼저 학습 자료를 추가해주세요." }, { status: 400 });
  }

  // 난이도 배분 계산
  const easyCount = Math.ceil(count * 0.3);
  const hardCount = Math.floor(count * 0.3);
  const medCount = count - easyCount - hardCount;

  const prompt = `당신은 ${subject.name} 과목 전문 출제 교사입니다. 아래 학습 자료를 분석하여 실력을 정확히 검증하는 퀴즈 ${count}개를 출제하세요.

[출제 지침]
- 난이도 배분: 쉬움 ${easyCount}개 / 보통 ${medCount}개 / 어려움 ${hardCount}개
- 문제 유형: 객관식(multiple) / OX(ox) / 단답형(short) 골고루 혼합
- 객관식 오답지는 학습 자료에 등장하는 유사 개념을 활용해 혼동을 유도하세요
- 단순 암기가 아닌 개념 이해·응용을 묻는 문제를 포함하세요
- 해설은 왜 정답인지 + 오답이 왜 틀렸는지를 간결하게 설명하세요
- 질문은 명확하고 모호하지 않게 작성하세요

[응답 형식] JSON 배열만 반환 (다른 텍스트 없이):
[
  {
    "type": "multiple",
    "question": "문제 내용",
    "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
    "answer": "정답 선택지 텍스트 (options 중 하나와 정확히 일치)",
    "explanation": "정답 근거 + 핵심 개념 설명"
  },
  {
    "type": "ox",
    "question": "참/거짓을 판단할 수 있는 명제",
    "options": [],
    "answer": "O",
    "explanation": "참/거짓 판단 근거"
  },
  {
    "type": "short",
    "question": "단답형 문제",
    "options": [],
    "answer": "간결한 정답 (1-5단어)",
    "explanation": "정답 근거와 추가 설명"
  }
]

[학습 자료 - ${subject.name}]
${context.slice(0, 8000)}`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "" });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const questions: {
      type: string;
      question: string;
      options: string[];
      answer: string;
      explanation: string;
    }[] = JSON.parse(json);

    const userId = session.user.id!;
    const saved = await Promise.all(
      questions.map(q =>
        prisma.quizQuestion.create({
          data: {
            userId,
            subjectId: id,
            type: ["multiple", "ox", "short"].includes(q.type) ? q.type : "short",
            question: q.question,
            options: q.options ?? [],
            answer: q.answer,
            explanation: q.explanation ?? "",
            tags: ["AI생성"],
          },
        })
      )
    );

    return NextResponse.json({ questions: saved });
  } catch (err) {
    console.error("AI quiz generation error:", err);
    return NextResponse.json({ error: "AI 문제 생성에 실패했습니다." }, { status: 500 });
  }
}
