import { NextRequest, NextResponse } from "next/server";
import { tavily } from "@tavily/core";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  snippet: string;
  category: string;
}

// ── RSS 피드 목록 ──────────────────────────────────────────────────────────────
const RSS_FEEDS: Record<string, { url: string; name: string }[]> = {
  all: [
    { url: "https://www.yonhapnews.co.kr/RSS/headlines.xml",     name: "연합뉴스" },
    { url: "https://www.chosun.com/arc/outboundfeeds/rss/",      name: "조선일보" },
    { url: "https://www.hani.co.kr/rss/",                        name: "한겨레" },
  ],
  economy: [
    { url: "https://www.yonhapnews.co.kr/RSS/economy.xml",       name: "연합뉴스" },
    { url: "https://www.mk.co.kr/rss/30100041/",                 name: "매일경제" },
    { url: "https://rss.hankyung.com/economy.xml",               name: "한국경제" },
  ],
  society: [
    { url: "https://www.yonhapnews.co.kr/RSS/politics.xml",      name: "연합뉴스" },
    { url: "https://www.hani.co.kr/rss/society/",                name: "한겨레" },
  ],
  tech: [
    { url: "https://www.yonhapnews.co.kr/RSS/it.xml",            name: "연합뉴스" },
    { url: "https://rss.etnews.com/Section901.xml",              name: "전자신문" },
  ],
  sports: [
    { url: "https://www.yonhapnews.co.kr/RSS/sports.xml",        name: "연합뉴스" },
    { url: "https://rss.hankyung.com/sports.xml",                name: "한국경제" },
    { url: "https://sports.chosun.com/news/rss/rss.htm",         name: "스포츠조선" },
    { url: "https://www.hani.co.kr/rss/sports/",                 name: "한겨레" },
  ],
  world: [
    { url: "https://www.yonhapnews.co.kr/RSS/international.xml", name: "연합뉴스" },
    { url: "https://www.hani.co.kr/rss/international/",          name: "한겨레" },
    { url: "https://www.chosun.com/arc/outboundfeeds/rss/category/international/", name: "조선일보" },
  ],
};

const TAVILY_QUERIES: Record<string, string> = {
  all:      "오늘 주요 뉴스 한국",
  economy:  "오늘 경제 주식 금융 뉴스",
  society:  "오늘 사회 정치 뉴스 한국",
  tech:     "오늘 IT 기술 AI 뉴스",
  sports:   "오늘 한국 스포츠 축구 야구 농구 뉴스",
  world:    "오늘 국제 세계 뉴스 한국어",
};

// Tavily에 한국 뉴스 도메인만 포함
const KOREAN_NEWS_DOMAINS = [
  "yonhapnews.co.kr", "yna.co.kr", "chosun.com", "hani.co.kr",
  "mk.co.kr", "hankyung.com", "joongang.co.kr", "joins.com",
  "donga.com", "sbs.co.kr", "kbs.co.kr", "mbc.co.kr",
  "etnews.com", "zdnet.co.kr", "bloter.net", "newsis.com",
  "news1.kr", "ohmynews.com", "khan.co.kr", "kmib.co.kr",
];

// ── 간단한 RSS XML 파서 ────────────────────────────────────────────────────────
function parseRss(xml: string, sourceName: string, category: string): NewsArticle[] {
  const items: NewsArticle[] = [];
  // <item>...</item> 블록 추출
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const block = match[1];
    const title   = extractTag(block, "title");
    const link    = extractTag(block, "link") || extractTag(block, "guid");
    const desc    = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");
    if (!title || !link) continue;
    if (isJunkArticle(title)) continue;
    items.push({
      title:       cleanHtml(title),
      url:         link.trim(),
      source:      sourceName,
      publishedAt: pubDate ? parsePubDate(pubDate) : null,
      snippet:     cleanHtml(desc).slice(0, 200),
      category,
    });
    if (items.length >= 6) break; // 피드당 최대 6개
  }
  return items;
}

function extractTag(xml: string, tag: string): string {
  // CDATA 포함 처리
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "si");
  return xml.match(re)?.[1]?.trim() ?? "";
}

function cleanHtml(str: string): string {
  return str.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#\d+;/g, "").trim();
}

function parsePubDate(str: string): string | null {
  try {
    return new Date(str).toISOString();
  } catch {
    return null;
  }
}

// ── RSS fetch ──────────────────────────────────────────────────────────────────
async function fetchRss(feed: { url: string; name: string }, category: string): Promise<NewsArticle[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LifeHub/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    // arrayBuffer로 받아 인코딩을 직접 처리 (연합뉴스 등 EUC-KR RSS 대응)
    const buffer = await res.arrayBuffer();
    const ct = res.headers.get("content-type") ?? "";
    // Content-Type 헤더의 charset 확인, 없으면 XML 선언 앞부분을 ASCII로 미리 읽어 확인
    const preview = new TextDecoder("ascii", { fatal: false }).decode(new Uint8Array(buffer).slice(0, 200));
    const isEucKr = /euc-kr|ks_c_5601|euc_kr/i.test(ct) || /encoding=["']EUC-KR["']/i.test(preview);
    const xml = new TextDecoder(isEucKr ? "euc-kr" : "utf-8").decode(buffer);

    return parseRss(xml, feed.name, category);
  } catch {
    return [];
  }
}

// ── Tavily fetch ───────────────────────────────────────────────────────────────
// 카테고리 페이지·홈페이지로 보이는 제목 패턴 필터
const JUNK_TITLE_RE = /^(뉴스|홈|영상|포토|스포츠|전체|메인|사진)\s*[-|·]\s*|^https?:\/\//i;
const GARBLED_RE = /[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FFa-zA-Z0-9\s\-_.,!?()[\]%&*#@$~<>"':;\/\\+]/;

function isJunkArticle(title: string): boolean {
  if (!title || title.length < 10) return true;
  if (JUNK_TITLE_RE.test(title)) return true;
  // 깨진 텍스트 감지: 비정상 특수문자가 전체의 10% 이상
  const garbledChars = (title.match(/[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u0020-\u007Ea-zA-Z0-9]/g) ?? []).length;
  if (garbledChars / title.length > 0.15) return true;
  return false;
}

async function fetchTavily(query: string, category: string): Promise<NewsArticle[]> {
  if (!process.env.TAVILY_API_KEY) return [];
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const result = await client.search(query, {
      searchDepth: "basic",
      maxResults: 8,
      includeAnswer: false,
      days: 1,
      topic: "news",
      includeDomains: KOREAN_NEWS_DOMAINS,
    } as Parameters<typeof client.search>[1]);
    return (result.results ?? [])
      .filter(r => r.title && !isJunkArticle(r.title))
      .map(r => ({
        title:       r.title ?? "",
        url:         r.url ?? "",
        source:      extractDomain(r.url ?? ""),
        publishedAt: (r as { published_date?: string }).published_date ?? null,
        snippet:     cleanSnippet(r.content?.slice(0, 200) ?? ""),
        category,
      }));
  } catch {
    return [];
  }
}

function cleanSnippet(text: string): string {
  // 깨진 특수문자·마크다운 잔여물 제거
  return text.replace(/\*\*?|\#{1,3}\s?/g, "").replace(/\s{2,}/g, " ").trim();
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

// ── URL 중복 제거 ──────────────────────────────────────────────────────────────
function dedup(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  return articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

// ── GET /api/news?category=all ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "all";

  // 캐시 확인 (15분)
  try {
    const cached = await prisma.newsCache.findUnique({ where: { category } });
    if (cached && cached.expiresAt > new Date()) {
      return NextResponse.json({ articles: cached.articles, cached: true });
    }
  } catch { /* DB 미연결 시 무시 */ }

  // RSS + Tavily 병렬 수집
  const feeds = RSS_FEEDS[category] ?? RSS_FEEDS.all;
  const [rssResults, tavilyArticles] = await Promise.all([
    Promise.all(feeds.map(f => fetchRss(f, category))),
    fetchTavily(TAVILY_QUERIES[category] ?? TAVILY_QUERIES.all, category),
  ]);

  const rssArticles = rssResults.flat();

  // RSS 우선, Tavily 보완 (총 최대 15개)
  const articles = dedup([...rssArticles, ...tavilyArticles]).slice(0, 15);

  // 캐시 저장 (15분 TTL)
  try {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.newsCache.upsert({
      where: { category },
      update: { articles: articles as object[], expiresAt },
      create: { category, articles: articles as object[], expiresAt },
    });
  } catch { /* 캐시 저장 실패 무시 */ }

  return NextResponse.json({ articles, cached: false });
}
