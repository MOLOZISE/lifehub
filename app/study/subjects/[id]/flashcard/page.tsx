"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Mode = "list" | "study" | "add" | "result";

interface Flashcard {
  id: string;
  subjectId: string;
  front: string;
  back: string;
  tags: string[];
  interval: number;
  easeFactor: number;
  nextReviewAt: string;
  reviewCount: number;
  known: boolean;
  createdAt: string;
}

interface SubjectInfo { emoji: string; name: string; }

function sm2Update(card: Flashcard, quality: number): Flashcard {
  let { interval, easeFactor } = card;
  if (quality >= 3) {
    interval = card.reviewCount === 0 ? 1 : card.reviewCount === 1 ? 6 : Math.round(interval * easeFactor);
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    interval = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  }
  const next = new Date();
  next.setDate(next.getDate() + interval);
  return { ...card, interval, easeFactor, reviewCount: card.reviewCount + 1, nextReviewAt: next.toISOString(), known: quality >= 3 };
}

export default function FlashcardPage() {
  const { id } = useParams<{ id: string }>();
  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [mode, setMode] = useState<Mode>("list");
  const [showBack, setShowBack] = useState(false);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [current, setCurrent] = useState(0);
  const [retryQueue, setRetryQueue] = useState<Flashcard[]>([]);
  const [results, setResults] = useState<{ card: Flashcard; known: boolean }[]>([]);
  const [showAllBack, setShowAllBack] = useState(false);
  // Add form
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    async function load() {
      const [subRes, cardsRes] = await Promise.all([
        fetch(`/api/study/subjects/${id}`),
        fetch(`/api/study/subjects/${id}/flashcards`),
      ]);
      if (subRes.ok) {
        const s = await subRes.json();
        setSubject({ emoji: s.emoji, name: s.name });
      }
      if (cardsRes.ok) setCards(await cardsRes.json());
    }
    load();
  }, [id]);

  // Keyboard shortcuts
  useEffect(() => {
    if (mode !== "study") return;
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") { e.preventDefault(); setShowBack(true); }
      if (e.key === "1" && showBack) handleRate(5);
      if (e.key === "2" && showBack) handleRate(1);
      if (e.key === "ArrowRight" && showBack) handleRate(3);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showBack, queue, current]);

  function startStudy() {
    const today = new Date().toISOString().slice(0, 10);
    const due = cards.filter(c => c.nextReviewAt.slice(0, 10) <= today);
    const fresh = cards.filter(c => c.nextReviewAt.slice(0, 10) > today);
    const q = [...due.sort(() => Math.random() - 0.5), ...fresh.sort(() => Math.random() - 0.5)];
    setQueue(q);
    setCurrent(0);
    setRetryQueue([]);
    setResults([]);
    setShowBack(false);
    setMode("study");
  }

  function handleRate(quality: number) {
    const card = queue[current];
    const updated = sm2Update(card, quality);
    const newCards = cards.map(c => c.id === card.id ? updated : c);
    setCards(newCards);
    // Persist SM-2 update
    fetch(`/api/study/subjects/${id}/flashcards/${card.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interval: updated.interval,
        easeFactor: updated.easeFactor,
        nextReviewAt: updated.nextReviewAt,
        reviewCount: updated.reviewCount,
        known: updated.known,
      }),
    });
    setResults(prev => [...prev, { card, known: quality >= 3 }]);
    if (quality < 3) setRetryQueue(prev => [...prev, updated]);

    const nextIdx = current + 1;
    if (nextIdx < queue.length) {
      setCurrent(nextIdx);
      setShowBack(false);
    } else if (retryQueue.length > 0) {
      setQueue([...retryQueue]);
      setRetryQueue([]);
      setCurrent(0);
      setShowBack(false);
    } else {
      setMode("result");
    }
  }

  async function handleAdd() {
    if (!front.trim() || !back.trim()) return;
    const res = await fetch(`/api/study/subjects/${id}/flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        front: front.trim(),
        back: back.trim(),
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) return;
    const card: Flashcard = await res.json();
    setCards(prev => [...prev, card]);
    setFront(""); setBack(""); setTags("");
  }

  async function handleDelete(cardId: string) {
    await fetch(`/api/study/subjects/${id}/flashcards/${cardId}`, { method: "DELETE" });
    setCards(prev => prev.filter(c => c.id !== cardId));
  }

  const today = new Date().toISOString().slice(0, 10);
  const dueCount = cards.filter(c => c.nextReviewAt.slice(0, 10) <= today).length;

  if (mode === "study" && queue.length > 0) {
    const card = queue[current];
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setMode("list")}><ArrowLeft className="w-4 h-4 mr-1" />그만하기</Button>
          <span className="text-sm text-muted-foreground">{current + 1}/{queue.length}</span>
        </div>
        <Progress value={((current + 1) / queue.length) * 100} />

        <div
          className="relative cursor-pointer"
          style={{ perspective: 1000 }}
          onClick={() => !showBack && setShowBack(true)}
        >
          <div
            className="relative w-full transition-all duration-500"
            style={{ transformStyle: "preserve-3d", transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)", minHeight: 240 }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center p-8 rounded-2xl border-2 bg-card text-center"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div>
                {card.tags.length > 0 && <div className="flex gap-1 justify-center mb-3">{card.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div>}
                <p className="text-xl font-semibold">{card.front}</p>
                <p className="text-xs text-muted-foreground mt-4">클릭하거나 Space를 눌러 뒤집기</p>
              </div>
            </div>
            <div
              className="absolute inset-0 flex items-center justify-center p-8 rounded-2xl border-2 border-primary bg-primary/5 text-center"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <p className="text-lg">{card.back}</p>
            </div>
          </div>
        </div>

        {showBack && (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => handleRate(1)}>
              😅 모르겠어요 (2)
            </Button>
            <Button variant="outline" className="flex-1 border-yellow-300 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950" onClick={() => handleRate(3)}>
              🤔 어렵게 알아요 (→)
            </Button>
            <Button variant="outline" className="flex-1 border-green-300 text-green-500 hover:bg-green-50 dark:hover:bg-green-950" onClick={() => handleRate(5)}>
              😊 알아요 (1)
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (mode === "result") {
    const known = results.filter(r => r.known).length;
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center">
        <h2 className="text-2xl font-bold">세션 완료! 🎉</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="p-4"><p className="text-3xl font-bold text-green-500">{known}</p><p className="text-sm text-muted-foreground">알아요</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-3xl font-bold text-red-500">{results.length - known}</p><p className="text-sm text-muted-foreground">모르겠어요</p></CardContent></Card>
        </div>
        <p className="text-muted-foreground text-sm">SM-2 알고리즘에 의해 다음 복습일이 자동으로 설정되었습니다.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={startStudy}><RotateCcw className="w-4 h-4 mr-2" />다시 학습</Button>
          <Button onClick={() => setMode("list")}>목록으로</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <LinkButton variant="ghost" size="icon" href={`/study/subjects/${id}`}><ArrowLeft className="w-4 h-4" /></LinkButton>
        <h2 className="font-semibold">{subject?.emoji} {subject?.name} — 플래시카드</h2>
        {dueCount > 0 && <Badge variant="destructive">{dueCount}장 복습 필요</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode("add")}><Plus className="w-3.5 h-3.5 mr-1" />카드 추가</Button>
          <Button size="sm" onClick={startStudy} disabled={cards.length === 0}><Play className="w-3.5 h-3.5 mr-1" />학습 시작</Button>
        </div>
      </div>

      {mode === "add" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium text-sm">새 카드 추가</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">앞면 (개념/용어)</p>
                <Textarea rows={3} placeholder="개념 또는 용어" value={front} onChange={e => setFront(e.target.value)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">뒷면 (설명/정의)</p>
                <Textarea rows={3} placeholder="설명 또는 정의" value={back} onChange={e => setBack(e.target.value)} />
              </div>
            </div>
            <Input placeholder="태그 (쉼표 구분)" value={tags} onChange={e => setTags(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!front.trim() || !back.trim()}>추가</Button>
              <Button size="sm" variant="outline" onClick={() => setMode("list")}>취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {cards.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">🃏</p>
          <p>플래시카드가 없습니다. 카드를 추가해보세요!</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">총 {cards.length}장</p>
            <Button variant="ghost" size="sm" onClick={() => setShowAllBack(!showAllBack)}>
              {showAllBack ? "앞면만" : "앞뒷면 모두 보기"}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map(card => (
              <Card key={card.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{card.front}</p>
                      {showAllBack && <p className="text-sm text-muted-foreground mt-1">{card.back}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDelete(card.id)}>
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                  {card.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">{card.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    복습 {card.reviewCount}회 | 다음: {new Date(card.nextReviewAt).toISOString().slice(0, 10)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
