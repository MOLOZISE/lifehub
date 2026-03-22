"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";

type FortuneKind = "daily" | "tarot" | "saju";
type SajuPeriod = "today" | "month" | "year" | "custom";

interface FortuneData {
  overall?: string; score?: number;
  categories?: Record<string, string>;
  luckyColor?: string; luckyNumber?: number; luckyFood?: string;
  advice?: string; caution?: string; luckyDirection?: string;
  cards?: Array<{ position: string; name: string; meaning: string; advice: string }>;
  cached?: boolean;
}

const TAROT_DECK = [
  "The Fool","The Magician","The High Priestess","The Empress","The Emperor",
  "The Hierophant","The Lovers","The Chariot","Strength","The Hermit",
  "Wheel of Fortune","Justice","The Hanged Man","Death","Temperance",
  "The Devil","The Tower","The Star","The Moon","The Sun","Judgement","The World",
  "Ace of Wands","Two of Wands","Three of Wands","Four of Wands","Five of Wands",
  "Six of Wands","Seven of Wands","Eight of Wands","Nine of Wands","Ten of Wands",
  "Page of Wands","Knight of Wands","Queen of Wands","King of Wands",
  "Ace of Cups","Two of Cups","Three of Cups","Four of Cups","Five of Cups",
  "Six of Cups","Seven of Cups","Eight of Cups","Nine of Cups","Ten of Cups",
  "Page of Cups","Knight of Cups","Queen of Cups","King of Cups",
  "Ace of Swords","Two of Swords","Three of Swords","Four of Swords","Five of Swords",
  "Six of Swords","Seven of Swords","Eight of Swords","Nine of Swords","Ten of Swords",
  "Page of Swords","Knight of Swords","Queen of Swords","King of Swords",
  "Ace of Pentacles","Two of Pentacles","Three of Pentacles","Four of Pentacles","Five of Pentacles",
  "Six of Pentacles","Seven of Pentacles","Eight of Pentacles","Nine of Pentacles","Ten of Pentacles",
  "Page of Pentacles","Knight of Pentacles","Queen of Pentacles","King of Pentacles",
];

function localToday() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export default function FortunePage() {
  const today = localToday();

  const [fortuneKind, setFortuneKind] = useState<FortuneKind>("daily");
  const [sajuPeriod, setSajuPeriod] = useState<SajuPeriod>("today");
  const [sajuStart, setSajuStart] = useState(today);
  const [sajuEnd, setSajuEnd] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [fortune, setFortune] = useState<FortuneData | null>(null);
  const [fortuneLoading, setFortuneLoading] = useState(false);

  // Tarot state
  const [deckShuffled, setDeckShuffled] = useState<string[]>([]);
  const [pickedCards, setPickedCards] = useState<string[]>([]);
  const [tarotReady, setTarotReady] = useState(false);
  const [tarotQuestion, setTarotQuestion] = useState("");

  // Load birthDate/birthTime from profile
  useEffect(() => {
    fetch("/api/user/profile").then(r => r.json()).then(d => {
      if (d.birthDate) setBirthDate(d.birthDate);
      if (d.birthTime) setBirthTime(d.birthTime);
    }).catch(() => {});
  }, []);

  function shuffleDeck() {
    setDeckShuffled([...TAROT_DECK].sort(() => Math.random() - 0.5));
    setPickedCards([]); setTarotReady(true); setFortune(null);
  }

  function pickCard(card: string) {
    if (pickedCards.includes(card) || pickedCards.length >= 3) return;
    setPickedCards(prev => [...prev, card]);
  }

  async function loadFortune() {
    if (!birthDate && fortuneKind !== "tarot") { toast.error("생년월일을 입력해주세요"); return; }
    if (fortuneKind === "tarot" && pickedCards.length < 3) { toast.error("카드 3장을 선택해주세요"); return; }

    setFortune(null); setFortuneLoading(true);
    try {
      const cacheKey = fortuneKind === "saju"
        ? `saju_${sajuStart}${sajuEnd ? "_" + sajuEnd : ""}`
        : fortuneKind;
      const cached = await fetch(`/api/planner/fortune?type=${cacheKey}`).then(r => r.json());
      if (cached.cached && (cached.overall || cached.cards)) { setFortune(cached); return; }

      const res = await fetch("/api/planner/fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: cacheKey, birthDate, birthTime,
          pickedCards: fortuneKind === "tarot" ? pickedCards : undefined,
          question: fortuneKind === "tarot" ? tarotQuestion : undefined,
          sajuStart: fortuneKind === "saju" ? sajuStart : undefined,
          sajuEnd: fortuneKind === "saju" ? sajuEnd : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setFortune(data);
    } catch { toast.error("운세 불러오기 실패"); }
    finally { setFortuneLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      <h1 className="text-xl font-bold">🔮 운세</h1>

      {/* Kind tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 text-xs">
        {([{k:"daily",l:"🌅 오늘 운세"},{k:"tarot",l:"🃏 타로"},{k:"saju",l:"☯️ 사주"}] as {k:FortuneKind,l:string}[]).map(({k,l}) => (
          <button key={k} onClick={() => { setFortuneKind(k); setFortune(null); }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${fortuneKind===k?"bg-background shadow-sm text-foreground":"text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Birth date (required for daily + saju) */}
      {fortuneKind !== "tarot" && (
        <Card className="border-dashed">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">생년월일 정보</p>
              {!birthDate && (
                <Link href="/profile" className="text-[10px] text-primary hover:underline">내 정보에서 설정 →</Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">생년월일 *</p>
                <input type="date" value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full h-8 text-sm bg-transparent border border-input rounded px-2 py-1" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">태어난 시각 (선택)</p>
                <input type="time" value={birthTime}
                  onChange={e => setBirthTime(e.target.value)}
                  className="w-full h-8 text-sm bg-transparent border border-input rounded px-2 py-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saju period selector */}
      {fortuneKind === "saju" && (
        <div className="space-y-2">
          <div className="flex gap-1 bg-muted/30 rounded-xl p-1 text-xs">
            {([{k:"today",l:"오늘"},{k:"month",l:"이번달"},{k:"year",l:`${today.slice(0,4)}년`},{k:"custom",l:"직접 선택"}] as {k:SajuPeriod,l:string}[]).map(({k,l}) => (
              <button key={k} onClick={() => {
                setSajuPeriod(k); setFortune(null);
                if (k==="today") { setSajuStart(today); setSajuEnd(""); }
                else if (k==="month") { setSajuStart(today.slice(0,7)+"-01"); setSajuEnd(""); }
                else if (k==="year") { setSajuStart(today.slice(0,4)+"-01-01"); setSajuEnd(""); }
              }}
                className={`flex-1 py-1 rounded-lg font-medium transition-all ${sajuPeriod===k?"bg-background shadow-sm text-foreground":"text-muted-foreground"}`}>
                {l}
              </button>
            ))}
          </div>
          {sajuPeriod === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">시작일 *</p>
                <Input type="date" value={sajuStart} onChange={e => { setSajuStart(e.target.value); setFortune(null); }} className="h-8 text-sm" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">종료일 (선택)</p>
                <Input type="date" value={sajuEnd} onChange={e => { setSajuEnd(e.target.value); setFortune(null); }} className="h-8 text-sm" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tarot card picker */}
      {fortuneKind === "tarot" && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">질문 (선택)</p>
            <Input placeholder="어떤 것이 궁금하신가요? (예: 올해 직장운은?)"
              value={tarotQuestion} onChange={e => setTarotQuestion(e.target.value)}
              className="h-8 text-sm" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">카드 3장을 선택하세요</p>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={shuffleDeck}>
              <RotateCcw className="w-3 h-3" />셔플
            </Button>
          </div>

          {!tarotReady ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">🃏</p>
              <p className="text-sm text-muted-foreground mb-3">먼저 카드를 셔플해주세요</p>
              <Button onClick={shuffleDeck} className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" />카드 셔플</Button>
            </div>
          ) : (
            <>
              {pickedCards.length > 0 && (
                <div className="flex gap-2">
                  {["과거","현재","미래"].map((pos, i) => (
                    <div key={pos} className={`flex-1 rounded-xl border p-2 text-center text-xs transition-all
                      ${pickedCards[i]?"bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800":"bg-muted/30 border-dashed"}`}>
                      <p className="text-[10px] text-muted-foreground font-medium">{pos}</p>
                      {pickedCards[i]
                        ? <p className="font-semibold text-[10px] mt-0.5 leading-tight">{pickedCards[i]}</p>
                        : <p className="text-muted-foreground mt-0.5">?</p>}
                    </div>
                  ))}
                </div>
              )}
              {pickedCards.length < 3 && (
                <p className="text-xs text-muted-foreground text-center">{pickedCards.length}/3 선택됨 · 직관적으로 끌리는 카드를 선택하세요</p>
              )}
              <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                {deckShuffled.map((card, i) => {
                  const picked = pickedCards.includes(card);
                  return (
                    <button key={i} onClick={() => pickCard(card)} disabled={picked || pickedCards.length >= 3}
                      className={`aspect-[2/3] rounded-lg border text-[8px] font-medium flex items-center justify-center text-center p-0.5 transition-all
                        ${picked?"bg-amber-400 dark:bg-amber-600 border-amber-500 text-white scale-95":"bg-muted/60 border-muted hover:bg-muted hover:scale-105 hover:border-primary/40"}
                        ${!picked&&pickedCards.length>=3?"opacity-30 cursor-not-allowed":""}`}>
                      {picked ? "✓" : "🂠"}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Run button */}
      <Button className="w-full gap-2" onClick={loadFortune} disabled={
        fortuneLoading ||
        (fortuneKind !== "tarot" && !birthDate) ||
        (fortuneKind === "tarot" && pickedCards.length < 3)
      }>
        {fortuneLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {fortuneLoading ? "분석 중..." : fortune ? "다시 보기" : "운세 보기"}
      </Button>

      {/* Fortune result */}
      {fortune && !fortuneLoading && (
        <div className="space-y-3">
          {/* Daily */}
          {fortuneKind === "daily" && (
            <>
              {fortune.overall && (
                <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🌅</span>
                      <span className="font-semibold text-sm flex-1">{today} 오늘의 운세</span>
                      {fortune.score && <Badge>{fortune.score}점</Badge>}
                    </div>
                    <p className="text-sm leading-relaxed">{fortune.overall}</p>
                  </CardContent>
                </Card>
              )}
              {fortune.categories && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(fortune.categories).map(([k, v]) => (
                    <Card key={k} className="bg-muted/30"><CardContent className="p-3">
                      <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{k}</p>
                      <p className="text-xs leading-relaxed">{v}</p>
                    </CardContent></Card>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                {fortune.luckyColor && <Badge variant="outline">🎨 {fortune.luckyColor}</Badge>}
                {fortune.luckyNumber != null && <Badge variant="outline">🔢 {fortune.luckyNumber}</Badge>}
                {fortune.luckyFood && <Badge variant="outline">🍀 {fortune.luckyFood}</Badge>}
              </div>
              {fortune.advice && <p className="text-sm text-muted-foreground italic border-l-4 border-violet-300 pl-3">{fortune.advice}</p>}
            </>
          )}

          {/* Tarot */}
          {fortuneKind === "tarot" && fortune.cards && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {fortune.cards.map((card, i) => (
                  <Card key={i} className="bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] text-amber-600 font-semibold">{card.position}</p>
                      <p className="text-[11px] font-bold my-1 leading-tight">{card.name}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{card.meaning}</p>
                      {card.advice && <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 italic">{card.advice}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {fortune.overall && <Card className="bg-muted/30"><CardContent className="p-4"><p className="text-xs font-medium mb-1">🔮 전체 흐름</p><p className="text-sm leading-relaxed">{fortune.overall}</p></CardContent></Card>}
              <div className="flex flex-wrap gap-2 text-xs">
                {fortune.luckyColor && <Badge variant="outline">🎨 {fortune.luckyColor}</Badge>}
                {fortune.luckyNumber != null && <Badge variant="outline">🔢 {fortune.luckyNumber}</Badge>}
              </div>
            </>
          )}

          {/* Saju */}
          {fortuneKind === "saju" && (
            <>
              {fortune.overall && (
                <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border-teal-200 dark:border-teal-800">
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm mb-1">
                      ☯️ {sajuEnd ? `${sajuStart} ~ ${sajuEnd}` : sajuPeriod==="today"?"오늘":sajuPeriod==="month"?"이번 달":sajuPeriod==="year"?`${today.slice(0,4)}년`:sajuStart} 운세
                    </p>
                    <p className="text-sm leading-relaxed">{fortune.overall}</p>
                  </CardContent>
                </Card>
              )}
              {fortune.categories && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(fortune.categories).map(([k, v]) => (
                    <Card key={k} className="bg-muted/30"><CardContent className="p-3">
                      <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{k}</p>
                      <p className="text-xs leading-relaxed">{v}</p>
                    </CardContent></Card>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                {fortune.luckyColor && <Badge variant="outline">🎨 {fortune.luckyColor}</Badge>}
                {fortune.luckyNumber != null && <Badge variant="outline">🔢 {fortune.luckyNumber}</Badge>}
                {fortune.luckyDirection && <Badge variant="outline">🧭 {fortune.luckyDirection}</Badge>}
              </div>
              {fortune.advice && <p className="text-sm leading-relaxed border-l-4 border-teal-300 pl-3">{fortune.advice}</p>}
              {fortune.caution && <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">⚠️ {fortune.caution}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
