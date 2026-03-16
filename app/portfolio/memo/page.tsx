"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface StrategyMemo { id: string; ticker: string; title: string; content: string; updatedAt: string; }

export default function MemoPage() {
  const [memos, setMemos] = useState<StrategyMemo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StrategyMemo | null>(null);
  const [ticker, setTicker] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function loadMemos() {
    const res = await fetch("/api/portfolio/strategy");
    if (res.ok) setMemos(await res.json());
  }

  useEffect(() => { loadMemos(); }, []);

  function openAdd() {
    setEditing(null); setTicker(""); setTitle(""); setContent(""); setDialogOpen(true);
  }
  function openEdit(m: StrategyMemo) {
    setEditing(m); setTicker(m.ticker); setTitle(m.title); setContent(m.content); setDialogOpen(true);
  }

  async function handleSave() {
    if (!title.trim()) return;
    if (editing) {
      const res = await fetch(`/api/portfolio/strategy/${editing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, title, content }),
      });
      if (!res.ok) { toast.error("저장 실패"); return; }
      toast.success("메모가 수정되었습니다");
    } else {
      const res = await fetch("/api/portfolio/strategy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker || "MEMO", title, content }),
      });
      if (!res.ok) { toast.error("저장 실패"); return; }
      toast.success("메모가 저장되었습니다");
    }
    setDialogOpen(false);
    loadMemos();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/portfolio/strategy/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    setMemos(m => m.filter(x => x.id !== id));
    toast.success("메모가 삭제되었습니다");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">전략 메모</h2>
          <p className="text-sm text-muted-foreground">종목별 투자 전략과 생각을 기록하세요</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />메모 추가</Button>
      </div>

      {memos.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">📋</p>
          <p>전략 메모가 없습니다. 투자 아이디어를 기록해보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memos.map(m => (
            <Card key={m.id} className="relative">
              <CardHeader className="pb-2 pt-4 px-4 flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                  {m.ticker && m.ticker !== "MEMO" && <Badge variant="outline" className="text-xs mb-1">{m.ticker}</Badge>}
                  <h3 className="font-semibold text-sm truncate">{m.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(m.updatedAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{m.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "메모 수정" : "메모 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><p className="text-xs mb-1">종목 (선택)</p><Input placeholder="예: 삼성전자, AAPL" value={ticker} onChange={e => setTicker(e.target.value)} /></div>
            <div><p className="text-xs mb-1">제목 *</p><Input placeholder="전략 요약" value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div><p className="text-xs mb-1">내용</p><Textarea rows={5} placeholder="투자 전략, 근거, 목표가 등을 자유롭게 작성하세요" value={content} onChange={e => setContent(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={!title.trim()}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
