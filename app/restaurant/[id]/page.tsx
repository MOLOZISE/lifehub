"use client";

import { useEffect, useState } from "react";
import { todayString } from "@/lib/utils-app";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Star, MapPin, Phone, ExternalLink, Trash2, ArrowLeft, Bookmark, BookmarkCheck, Pencil, Sparkles, Plus, Check, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface RestaurantList {
  id: string;
  name: string;
  emoji: string;
  color: string;
  itemCount: number;
}

interface Review {
  id: string;
  userId: string;
  rating: number;
  content: string;
  visitedAt: string | null;
  isAnonymous: boolean;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
}

interface RestaurantDetail {
  id: string;
  userId: string;
  name: string;
  category: string;
  address: string;
  roadAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  url: string | null;
  description: string | null;
  avgRating: number;
  reviewCount: number;
  user: { id: string; name: string | null };
  reviews: Review[];
  bookmarks: { id: string; listName: string }[];
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)}>
          <Star className={`w-6 h-6 transition-colors ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-amber-300"}`} />
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
      ))}
    </span>
  );
}

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: "", visitedAt: "", isAnonymous: false });
  const [submitting, setSubmitting] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", category: "", address: "", phone: "", url: "", description: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [listSheet, setListSheet] = useState(false);
  const [myLists, setMyLists] = useState<RestaurantList[]>([]);
  const [listItemIds, setListItemIds] = useState<Set<string>>(new Set()); // listId -> 이 맛집 포함 여부
  const [togglingList, setTogglingList] = useState<string | null>(null);

  const CATEGORIES = ["한식", "중식", "일식", "양식", "카페", "기타"];

  async function loadDetail() {
    const res = await fetch(`/api/restaurant/${id}`);
    if (res.ok) setRestaurant(await res.json());
    else router.push("/restaurant");
    setLoading(false);
  }

  useEffect(() => { loadDetail(); }, [id]);

  // ?review=1 쿼리로 진입 시 리뷰 다이얼로그 자동 오픈
  useEffect(() => {
    if (!loading && restaurant && searchParams.get("review") === "1") {
      setReviewDialog(true);
    }
  }, [loading, restaurant, searchParams]);

  async function openListSheet() {
    const res = await fetch("/api/restaurant/lists");
    if (res.ok) {
      const lists: RestaurantList[] = await res.json();
      setMyLists(lists);
      // 이 맛집이 어느 리스트에 있는지 확인
      const inIds = new Set<string>();
      await Promise.all(lists.map(async (list) => {
        const r = await fetch(`/api/restaurant/lists/${list.id}/items?limit=500`);
        if (r.ok) {
          const data = await r.json();
          if (data.items?.some((item: { restaurant: { id: string } }) => item.restaurant.id === id)) {
            inIds.add(list.id);
          }
        }
      }));
      setListItemIds(inIds);
    }
    setListSheet(true);
  }

  async function toggleList(listId: string) {
    setTogglingList(listId);
    try {
      const res = await fetch(`/api/restaurant/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: id }),
      });
      if (!res.ok) { toast.error("실패했습니다."); return; }
      const data = await res.json();
      setListItemIds(prev => {
        const next = new Set(prev);
        data.added ? next.add(listId) : next.delete(listId);
        return next;
      });
      toast.success(data.added ? "리스트에 추가했습니다" : "리스트에서 제거했습니다");
    } finally {
      setTogglingList(null);
    }
  }

  function openEdit() {
    if (!restaurant) return;
    setEditForm({ name: restaurant.name, category: restaurant.category, address: restaurant.address, phone: restaurant.phone ?? "", url: restaurant.url ?? "", description: restaurant.description ?? "" });
    setEditDialog(true);
  }

  async function handleEdit() {
    setEditSaving(true);
    const res = await fetch(`/api/restaurant/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditSaving(false);
    if (!res.ok) { toast.error("수정 실패"); return; }
    toast.success("수정됐습니다.");
    setEditDialog(false);
    loadDetail();
  }

  async function handleDelete() {
    if (!confirm("이 맛집을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/restaurant/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    toast.success("삭제되었습니다.");
    router.push("/restaurant");
  }

  async function handleReviewSubmit() {
    if (!reviewForm.content) { toast.error("리뷰 내용을 입력하세요."); return; }
    setSubmitting(true);
    const res = await fetch(`/api/restaurant/${id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reviewForm),
    });
    setSubmitting(false);
    if (!res.ok) { toast.error("리뷰 등록 실패"); return; }
    toast.success("리뷰가 등록되었습니다!");
    setReviewDialog(false);
    setReviewForm({ rating: 5, content: "", visitedAt: "", isAnonymous: false });
    loadDetail();
  }

  async function handleAiSummary() {
    if (!restaurant || restaurant.reviews.length < 2) return;
    const cacheKey = `ai_summary_${restaurant.id}_${todayString()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setAiSummary(cached); return; }
    setAiLoading(true);
    try {
      const reviewTexts = restaurant.reviews
        .map(r => `별점 ${r.rating}점: ${r.content}`)
        .join("\n");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: "당신은 맛집 리뷰 분석 전문가입니다. 주어진 리뷰들을 분석해서 맛/서비스/분위기/가성비를 각각 별점(★☆ 5점 기준)으로 표현하고, 이 맛집의 특징을 2-3문장으로 요약하세요. 한국어로 간결하게 답변하세요.",
          userMessage: `다음은 "${restaurant.name}" 맛집의 리뷰입니다:\n\n${reviewTexts}`,
          useSearch: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.text ?? data.result ?? null;
        setAiSummary(text);
        if (text) localStorage.setItem(cacheKey, text);
      } else {
        toast.error("AI 요약에 실패했습니다.");
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function handleDeleteReview(reviewId: string) {
    if (!confirm("리뷰를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/restaurant/${id}/reviews`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId }),
    });
    if (!res.ok) { toast.error("삭제 실패"); return; }
    toast.success("삭제되었습니다.");
    loadDetail();
  }

  if (loading) return <div className="text-center py-16 text-muted-foreground">불러오는 중...</div>;
  if (!restaurant) return null;

  const isOwner = session?.user?.id === restaurant.userId;
  const isInAnyList = listItemIds.size > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" />뒤로
        </Button>
      </div>

      {/* Main info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{restaurant.category}</Badge>
                <h1 className="text-xl font-bold">{restaurant.name}</h1>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>{restaurant.address}</span>
                </div>
                {restaurant.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{restaurant.phone}</span>
                  </div>
                )}
              </div>
              {restaurant.description && (
                <p className="mt-3 text-sm">{restaurant.description}</p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className={`w-4 h-4 ${i <= Math.round(restaurant.avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  ))}
                  <span className="font-semibold">{restaurant.avgRating > 0 ? restaurant.avgRating.toFixed(1) : "-"}</span>
                  <span className="text-muted-foreground text-xs">({restaurant.reviewCount}개)</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <button onClick={openListSheet} className="p-2 rounded-md hover:bg-accent transition-colors" title="내 리스트에 저장">
                {isInAnyList
                  ? <BookmarkCheck className="w-5 h-5 text-primary" />
                  : <Bookmark className="w-5 h-5 text-muted-foreground" />
                }
              </button>
              {restaurant.url && (
                <a href={restaurant.url} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-md hover:bg-accent transition-colors">
                  <ExternalLink className="w-5 h-5 text-muted-foreground" />
                </a>
              )}
              {isOwner && (
                <>
                  <button onClick={openEdit} className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground">
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button onClick={handleDelete} className="p-2 rounded-md hover:bg-accent transition-colors text-destructive">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      {(restaurant.latitude && restaurant.longitude) || restaurant.address ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-0.5">위치</p>
                <p className="text-xs text-muted-foreground truncate">
                  {restaurant.roadAddress || restaurant.address}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a
                  href={
                    restaurant.latitude && restaurant.longitude
                      ? `https://map.kakao.com/link/map/${encodeURIComponent(restaurant.name)},${restaurant.latitude},${restaurant.longitude}`
                      : `https://map.kakao.com/link/search/${encodeURIComponent(restaurant.roadAddress || restaurant.address)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-accent transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />카카오맵
                </a>
                <a
                  href={`https://map.naver.com/v5/search/${encodeURIComponent(restaurant.roadAddress || restaurant.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-accent transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />네이버맵
                </a>
              </div>
            </div>
            {restaurant.latitude && restaurant.longitude && (
              <iframe
                className="w-full mt-3 rounded-lg border"
                height={220}
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&z=15&output=embed`}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Reviews */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">리뷰 ({restaurant.reviewCount})</CardTitle>
            <div className="flex gap-2">
              {restaurant.reviewCount >= 2 && (
                <Button size="sm" variant="outline" onClick={handleAiSummary} disabled={aiLoading} className="gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiLoading ? "분석 중..." : "AI 요약"}
                </Button>
              )}
              <Button size="sm" onClick={() => setReviewDialog(true)}>리뷰 작성</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {aiSummary && (
            <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">AI 리뷰 요약</span>
                <button onClick={() => setAiSummary(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xs">닫기</button>
              </div>
              <p className="text-sm whitespace-pre-line leading-relaxed">{aiSummary}</p>
            </div>
          )}
          {restaurant.reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">아직 리뷰가 없습니다. 첫 리뷰를 남겨보세요!</p>
          ) : (
            <div className="space-y-4">
              {restaurant.reviews.map(review => (
                <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <StarDisplay value={review.rating} />
                      <span className="text-sm font-medium">
                        {review.isAnonymous ? "익명" : (review.user.name ?? "알 수 없음")}
                      </span>
                      {review.visitedAt && (
                        <span className="text-xs text-muted-foreground">방문: {review.visitedAt}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                      {session?.user?.id === review.userId && (
                        <button onClick={() => handleDeleteReview(review.id)} className="p-1 text-destructive hover:bg-accent rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm">{review.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review dialog */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>리뷰 작성 — {restaurant.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs mb-2">별점</p>
              <StarPicker value={reviewForm.rating} onChange={v => setReviewForm(f => ({ ...f, rating: v }))} />
            </div>
            <div>
              <p className="text-xs mb-1">방문일 (선택)</p>
              <Input type="date" value={reviewForm.visitedAt} onChange={e => setReviewForm(f => ({ ...f, visitedAt: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs mb-1">리뷰 내용</p>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-ring"
                value={reviewForm.content}
                onChange={e => setReviewForm(f => ({ ...f, content: e.target.value }))}
                placeholder="맛, 분위기, 서비스 등을 자유롭게 남겨주세요."
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={reviewForm.isAnonymous}
                onChange={e => setReviewForm(f => ({ ...f, isAnonymous: e.target.checked }))}
                className="rounded"
              />
              익명으로 작성
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(false)}>취소</Button>
            <Button onClick={handleReviewSubmit} disabled={submitting}>등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 맛집 수정 다이얼로그 */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>맛집 정보 수정</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1">카테고리</p>
                <Select value={editForm.category} onValueChange={v => setEditForm(f => ({ ...f, category: v ?? f.category }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs mb-1">상호명</p>
                <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div>
              <p className="text-xs mb-1">주소</p>
              <Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs mb-1">전화번호</p>
                <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="02-1234-5678" />
              </div>
              <div>
                <p className="text-xs mb-1">지도 URL</p>
                <Input value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} />
              </div>
            </div>
            <div>
              <p className="text-xs mb-1">한줄 소개</p>
              <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>취소</Button>
            <Button onClick={handleEdit} disabled={editSaving}>{editSaving ? "저장 중..." : "저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 리스트 저장 Sheet */}
      <Sheet open={listSheet} onOpenChange={setListSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" />내 리스트에 저장
            </SheetTitle>
          </SheetHeader>
          {myLists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm mb-3">아직 리스트가 없어요</p>
              <Button size="sm" variant="outline" onClick={() => { setListSheet(false); window.location.href = "/restaurant/mylist"; }}>
                리스트 만들러 가기
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pb-6">
              {myLists.map(list => {
                const inList = listItemIds.has(list.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => toggleList(list.id)}
                    disabled={togglingList === list.id}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      inList ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{list.emoji}</span>
                      <div className="text-left">
                        <p className="font-medium text-sm">{list.name}</p>
                        <p className="text-xs text-muted-foreground">{list.itemCount}개</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                      inList ? "bg-primary border-primary" : "border-muted-foreground/30"
                    }`}>
                      {inList && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 mt-2"
                onClick={() => { setListSheet(false); window.location.href = "/restaurant/mylist"; }}
              >
                <Plus className="w-3.5 h-3.5" />새 리스트 만들기
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
