"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, BookOpen, Newspaper, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CHAT_SYSTEM_PROMPT = `당신은 친절한 주식 투자 교육 전문가입니다. 초보자도 이해할 수 있도록 개념 설명 → 실제 사례 → 핵심 요약 순서로 한국어로 가르쳐 주세요. 중요한 숫자나 공식은 **굵게** 표시하고, 목록을 활용해 가독성 있게 설명하세요. 최신 시장 정보가 필요한 경우 Google 검색을 활용하세요.`;

const NEWS_SYSTEM_PROMPT = `당신은 주식/금융 시장 뉴스 큐레이터입니다. Google 검색을 통해 오늘의 주요 시장 뉴스와 이슈를 조사하고, 투자자에게 중요한 내용을 요약해주세요.

다음 형식으로 응답하세요:
## 📊 오늘의 시장 동향
- 주요 지수 현황

## 🔥 주요 뉴스
- 뉴스1 (날짜)
- 뉴스2 (날짜)

## 💡 투자자 주목 포인트
- 포인트1
- 포인트2

## ⚠️ 리스크 요인
- 리스크1

최신 실제 데이터를 기반으로 작성하세요.`;

const TOPICS = [
  { label: "기초", items: ["주식이란?", "주식 시장 구조", "매수/매도 방법", "호가창 읽기"] },
  { label: "기술적 분석", items: ["캔들스틱 패턴", "이동평균선", "RSI 지표", "MACD 분석"] },
  { label: "펀더멘털", items: ["PER/PBR 이해", "재무제표 읽기", "ROE/ROA", "배당 투자"] },
  { label: "파생상품", items: ["선물/옵션 기초", "공매도란?", "ETF 이해", "레버리지/인버스"] },
  { label: "투자 심리", items: ["손절의 중요성", "분산투자 원칙", "공포/탐욕 지수", "투자 원칙 세우기"] },
];

interface Message { role: "user" | "assistant"; content: string; }

type Tab = "chat" | "news";

export default function LearnPage() {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("기초");
  const [newsContent, setNewsContent] = useState("");
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsLoadedAt, setNewsLoadedAt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const history = newMessages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: CHAT_SYSTEM_PROMPT,
          userMessage: text,
          history: history.slice(0, -1),
          useSearch: true,
        }),
      });
      const data = await res.json();
      if (data.error) { setMessages(p => [...p, { role: "assistant", content: `오류: ${data.error}` }]); return; }
      setMessages(p => [...p, { role: "assistant", content: data.text }]);
    } catch { setMessages(p => [...p, { role: "assistant", content: "API 호출 실패. .env.local 의 GEMINI_API_KEY를 확인해주세요." }]); }
    finally { setLoading(false); }
  }

  async function loadNews() {
    setNewsLoading(true); setNewsContent("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: NEWS_SYSTEM_PROMPT,
          userMessage: "오늘의 주요 주식/금융 시장 뉴스와 동향을 Google 검색으로 조사해서 요약해주세요.",
          useSearch: true,
        }),
      });
      const data = await res.json();
      if (data.error) { setNewsContent(`오류: ${data.error}`); return; }
      setNewsContent(data.text);
      setNewsLoadedAt(new Date().toLocaleString("ko-KR"));
    } catch { setNewsContent("뉴스를 불러오지 못했습니다."); }
    finally { setNewsLoading(false); }
  }

  useEffect(() => {
    if (tab === "news" && !newsContent && !newsLoading) loadNews();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col gap-3">
      {/* Tab bar */}
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => setTab("chat")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "chat" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent text-muted-foreground"}`}
        >
          <BookOpen className="w-4 h-4" />AI 튜터
        </button>
        <button
          onClick={() => setTab("news")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "news" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent text-muted-foreground"}`}
        >
          <Newspaper className="w-4 h-4" />오늘의 시장 뉴스
          <Badge variant="secondary" className="text-[10px] h-4 ml-1">Live</Badge>
        </button>
      </div>

      {/* Chat tab */}
      {tab === "chat" && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Topic sidebar */}
          <div className="w-48 shrink-0 flex flex-col gap-2 overflow-y-auto">
            <h3 className="font-semibold text-sm flex items-center gap-1.5 shrink-0"><BookOpen className="w-4 h-4" />학습 주제</h3>
            {TOPICS.map(topic => (
              <div key={topic.label}>
                <p className={`text-xs font-medium mb-1 cursor-pointer px-2 py-1 rounded ${selectedCategory === topic.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSelectedCategory(topic.label)}>
                  {topic.label}
                </p>
                {selectedCategory === topic.label && (
                  <div className="space-y-0.5">
                    {topic.items.map(item => (
                      <button key={item} onClick={() => sendMessage(`${item}에 대해 설명해주세요`)}
                        className="w-full text-left text-xs px-3 py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col border rounded-xl overflow-hidden min-h-0">
            <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
              <p className="text-sm font-medium">주식 투자 AI 튜터</p>
              <p className="text-xs text-muted-foreground">Google 검색 기반 최신 정보로 답변합니다</p>
            </div>
            <ScrollArea className="flex-1 px-4 py-4">
              {messages.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-4xl mb-3">🎓</p>
                  <p className="font-medium">주식 투자 AI 튜터</p>
                  <p className="text-sm mt-1">왼쪽 주제를 클릭하거나 질문을 입력해보세요</p>
                </div>
              )}
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
              <div ref={bottomRef} />
            </ScrollArea>
            <div className="p-3 border-t flex gap-2 shrink-0">
              <Input placeholder="질문을 입력하세요..." value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                className="flex-1" />
              <Button size="icon" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* News tab */}
      {tab === "news" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">오늘의 시장 뉴스</p>
              {newsLoadedAt && <p className="text-xs text-muted-foreground">{newsLoadedAt} 기준</p>}
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={loadNews} disabled={newsLoading}>
              <RefreshCw className={`w-3 h-3 ${newsLoading ? "animate-spin" : ""}`} />새로고침
            </Button>
          </div>
          {newsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="w-7 h-7 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium">Google 검색으로 오늘의 뉴스 수집 중...</p>
                <p className="text-xs mt-1 opacity-60">10~20초 소요될 수 있습니다</p>
              </div>
            </div>
          ) : newsContent ? (
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{newsContent}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
