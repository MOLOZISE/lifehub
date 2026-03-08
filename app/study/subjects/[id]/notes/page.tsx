"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Save, Star, Search, Eye, Edit3, Pin } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getSubjectById, getNotes, saveNotes } from "@/lib/storage";
import { generateId } from "@/lib/utils-app";
import type { Note, Subject } from "@/lib/types";

export default function NotesPage() {
  const { id } = useParams<{ id: string }>();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [autoSaveLabel, setAutoSaveLabel] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSubject(getSubjectById(id) ?? null);
    const loaded = getNotes(id);
    setNotes(loaded);
    if (loaded.length > 0) selectNote(loaded[0]);
  }, [id]);

  function selectNote(note: Note) {
    setSelectedId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags(note.tags.join(", "));
    setPreview(false);
  }

  const doSave = useCallback((title: string, content: string, tags: string, notesArr: Note[], noteId: string) => {
    const now = new Date().toISOString();
    const next = notesArr.map(n =>
      n.id === noteId
        ? { ...n, title, content, tags: tags.split(",").map(t => t.trim()).filter(Boolean), updatedAt: now }
        : n
    );
    saveNotes(id, next);
    setNotes(next);
    setAutoSaveLabel("저장됨 ✓");
    setTimeout(() => setAutoSaveLabel(""), 2000);
  }, [id]);

  function handleContentChange(v: string) {
    setEditContent(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (selectedId) doSave(editTitle, v, editTags, notes, selectedId);
    }, 2000);
  }

  function handleNew() {
    const now = new Date().toISOString();
    const note: Note = {
      id: generateId(), subjectId: id,
      title: "새 노트", content: "", tags: [], isPinned: false,
      createdAt: now, updatedAt: now,
    };
    const next = [note, ...notes];
    setNotes(next);
    saveNotes(id, next);
    selectNote(note);
  }

  function handleDelete(noteId: string) {
    const next = notes.filter(n => n.id !== noteId);
    setNotes(next);
    saveNotes(id, next);
    if (selectedId === noteId) {
      if (next.length > 0) selectNote(next[0]);
      else { setSelectedId(null); setEditTitle(""); setEditContent(""); setEditTags(""); }
    }
  }

  function handlePin(noteId: string) {
    const next = notes.map(n => n.id === noteId ? { ...n, isPinned: !n.isPinned } : n);
    setNotes(next);
    saveNotes(id, next);
  }

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags)));
  const filtered = notes
    .filter(n => {
      const q = search.toLowerCase();
      return (!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
        && (!filterTag || n.tags.includes(filterTag));
    })
    .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt));

  const selectedNote = notes.find(n => n.id === selectedId);

  return (
    <div className="max-w-6xl mx-auto space-y-4 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center gap-3 shrink-0">
        <LinkButton variant="ghost" size="icon" href={`/study/subjects/${id}`}><ArrowLeft className="w-4 h-4" /></LinkButton>
        <h2 className="font-semibold">{subject?.emoji} {subject?.name} — 노트</h2>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          <Button size="sm" onClick={handleNew} className="w-full"><Plus className="w-3.5 h-3.5 mr-1" />새 노트</Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="검색..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Badge variant={filterTag === "" ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setFilterTag("")}>전체</Badge>
              {allTags.map(tag => (
                <Badge key={tag} variant={filterTag === tag ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setFilterTag(tag)}>{tag}</Badge>
              ))}
            </div>
          )}
          <ScrollArea className="flex-1 border rounded-lg">
            {filtered.map(note => (
              <div key={note.id}>
                <button onClick={() => selectNote(note)} className={`w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors group ${selectedId === note.id ? "bg-accent" : ""}`}>
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate font-medium text-xs leading-5">{note.isPinned ? "📌 " : ""}{note.title || "제목 없음"}</p>
                  </div>
                  {note.tags.length > 0 && <p className="text-xs text-muted-foreground truncate mt-0.5">{note.tags.join(", ")}</p>}
                </button>
                <Separator />
              </div>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">노트 없음</p>}
          </ScrollArea>
        </div>

        {/* Editor */}
        {selectedId && selectedNote ? (
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden min-w-0">
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 shrink-0">
              <Input
                className="flex-1 border-none shadow-none bg-transparent font-semibold text-sm focus-visible:ring-0 h-7 px-0"
                value={editTitle}
                onChange={e => { setEditTitle(e.target.value); handleContentChange(editContent); }}
                placeholder="제목"
              />
              <span className="text-xs text-muted-foreground">{autoSaveLabel}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePin(selectedId)}>
                <Pin className={`w-3.5 h-3.5 ${selectedNote.isPinned ? "text-primary fill-primary" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreview(!preview)}>
                {preview ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(selectedId)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="px-4 py-1.5 border-b shrink-0">
              <Input
                className="border-none shadow-none text-xs text-muted-foreground focus-visible:ring-0 h-6 px-0"
                placeholder="태그 (쉼표 구분, Enter로 저장)"
                value={editTags}
                onChange={e => setEditTags(e.target.value)}
                onBlur={() => { if (selectedId) doSave(editTitle, editContent, editTags, notes, selectedId); }}
              />
            </div>
            <div className="flex-1 overflow-auto">
              {preview ? (
                <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{editContent || "*내용 없음*"}</ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  className="w-full h-full resize-none border-none shadow-none rounded-none focus-visible:ring-0 text-sm font-mono p-4"
                  placeholder="마크다운으로 작성하세요..."
                  value={editContent}
                  onChange={e => handleContentChange(e.target.value)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center border rounded-lg text-muted-foreground">
            <div className="text-center">
              <p className="text-4xl mb-2">📝</p>
              <p className="text-sm">노트를 선택하거나 새로 만드세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
