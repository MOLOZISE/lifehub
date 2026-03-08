"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const SYSTEM_PROMPT = `당신은 친절한 주식 투자 교육 전문가입니다. 초보자도 이해할 수 있도록 개념 설명 → 실제 사례 → 핵심 요약 순서로 한국어로 가르쳐 주세요. 중요한 숫자나 공식은 **굵게** 표시하고, 목록을 활용해 가독성 있게 설명하세요.`;

const TOPICS = [
  { label: "기초", items: ["주식이란?", "주식 시장 구조", "매수/매도 방법", "호가창 읽기"] },
  { label: "기술적 분석", items: ["캔들스틱 패턴", "이동평균선", "RSI 지표", "MACD 분석"] },
  { label: "펀더멘털", items: ["PER/PBR 이해", "재무제표 읽기", "ROE/ROA", "배당 투자"] },
  { label: "파생상품", items: ["선물/옵션 기초", "공매도란?", "ETF 이해", "레버리지/인버스"] },
  { label: "투자 심리", items: ["손절의 중요성", "분산투자 원칙", "공포/탐욕 지수", "투자 원칙 세우기"] },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function LearnPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("기초");
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
          systemPrompt: SYSTEM_PROMPT,
          userMessage: text,
          history: history.slice(0, -1),
        }),
      });
      const data = await res.json();
      if (data.error) { setMessages(p => [...p, { role: "assistant", content: `오류: ${data.error}` }]); return; }
      setMessages(p => [...p, { role: "assistant", content: data.text }]);
    } catch { setMessages(p => [...p, { role: "assistant", content: "API 호출 실패. ANTHROPIC_API_KEY를 확인해주세요." }]); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex gap-4">
      {/* Topic sidebar */}
      <div className="w-52 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <h3 className="font-semibold text-sm flex items-center gap-1.5"><BookOpen className="w-4 h-4" />학습 주제</h3>
        {TOPICS.map(topic => (
          <div key={topic.label}>
            <p className={`text-xs font-medium mb-1 cursor-pointer px-2 py-1 rounded ${selectedCategory === topic.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setSelectedCategory(topic.label)}>
              {topic.label}
            </p>
            {selectedCategory === topic.label && (
              <div className="space-y-1">
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
      <div className="flex-1 flex flex-col border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-sm font-medium">주식 투자 AI 튜터</p>
          <p className="text-xs text-muted-foreground">왼쪽 주제를 클릭하거나 직접 질문하세요</p>
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
        <div className="p-3 border-t flex gap-2">
          <Input
            placeholder="질문을 입력하세요..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            className="flex-1"
          />
          <Button size="icon" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
