"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Subject, type SubjectColor } from "@/lib/types";
import { generateId, COLOR_MAP } from "@/lib/utils-app";

const COLORS: SubjectColor[] = ["red","orange","yellow","green","blue","indigo","purple","pink"];
const EMOJIS = ["📚","✏️","🔬","🧮","💻","🎨","🌏","⚖️","🏥","🏗️","📊","🎵","🧪","📐","🌱","🤖"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (subject: Subject) => void;
  initial?: Subject;
}

export function SubjectFormDialog({ open, onClose, onSave, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState<SubjectColor>(initial?.color ?? "blue");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "📚");
  const [examDate, setExamDate] = useState(initial?.examDate ?? "");

  function handleSave() {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? generateId(),
      name: name.trim(),
      description: description.trim(),
      color,
      emoji,
      examDate: examDate || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      lastStudiedAt: initial?.lastStudiedAt,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "과목 수정" : "과목 추가"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Emoji picker */}
          <div>
            <p className="text-sm font-medium mb-2">아이콘</p>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors",
                    emoji === e ? "border-primary bg-accent" : "border-transparent hover:border-muted"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <p className="text-sm font-medium mb-2">색상</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all",
                    COLOR_MAP[c].bg,
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">과목명 *</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 정보처리기사" />
          </div>

          <div>
            <p className="text-sm font-medium mb-1">설명</p>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="간단한 설명을 입력하세요" rows={2} />
          </div>

          <div>
            <p className="text-sm font-medium mb-1">시험 날짜 <span className="text-muted-foreground font-normal text-xs">(선택)</span></p>
            <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
