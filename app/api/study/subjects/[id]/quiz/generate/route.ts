import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

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

  const prompt = `아래 학습 자료를 바탕으로 ${count}개의 퀴즈 문제를 만들어주세요.
각 문제 유형을 골고루 섞어서(객관식/OX/단답형) JSON 배열로만 반환하세요.

형식:
[
  {
    "type": "multiple",
    "question": "문제 내용",
    "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
    "answer": "정답 선택지 텍스트",
    "explanation": "해설"
  },
  {
    "type": "ox",
    "question": "OX 문제 내용",
    "options": [],
    "answer": "O",
    "explanation": "해설"
  },
  {
    "type": "short",
    "question": "단답형 문제",
    "options": [],
    "answer": "정답",
    "explanation": "해설"
  }
]

오직 JSON 배열만 반환하고 다른 텍스트는 포함하지 마세요.

학습 자료:
${context.slice(0, 8000)}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const questions: {
      type: string;
      question: string;
      options: string[];
      answer: string;
      explanation: string;
    }[] = JSON.parse(json);

    const userId = session.user.id!;
    // Bulk-save to DB
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
