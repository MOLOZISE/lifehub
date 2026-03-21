// 주요 종목 정적 목록 — Yahoo Finance 티커 기준
// 타이핑 자동완성에 활용 (API 호출 없음)

export interface StockItem {
  ticker: string;   // Yahoo Finance ticker
  name: string;     // 표시명
  nameEn?: string;  // 영문명 (검색용)
  market: "KR" | "US" | "INDEX" | "ETF" | "FUTURES";
}

export const STOCK_LIST: StockItem[] = [
  // ── 한국 주요 종목 (KOSPI) ──────────────────────────────────────
  { ticker: "005930.KS", name: "삼성전자",         nameEn: "Samsung Electronics",  market: "KR" },
  { ticker: "000660.KS", name: "SK하이닉스",        nameEn: "SK Hynix",              market: "KR" },
  { ticker: "373220.KS", name: "LG에너지솔루션",    nameEn: "LG Energy Solution",    market: "KR" },
  { ticker: "207940.KS", name: "삼성바이오로직스",   nameEn: "Samsung Biologics",     market: "KR" },
  { ticker: "005380.KS", name: "현대차",            nameEn: "Hyundai Motor",         market: "KR" },
  { ticker: "000270.KS", name: "기아",              nameEn: "Kia",                   market: "KR" },
  { ticker: "005490.KS", name: "POSCO홀딩스",       nameEn: "POSCO Holdings",        market: "KR" },
  { ticker: "068270.KS", name: "셀트리온",           nameEn: "Celltrion",             market: "KR" },
  { ticker: "105560.KS", name: "KB금융",            nameEn: "KB Financial",          market: "KR" },
  { ticker: "055550.KS", name: "신한지주",           nameEn: "Shinhan Financial",     market: "KR" },
  { ticker: "086790.KS", name: "하나금융지주",       nameEn: "Hana Financial",        market: "KR" },
  { ticker: "051910.KS", name: "LG화학",            nameEn: "LG Chem",               market: "KR" },
  { ticker: "006400.KS", name: "삼성SDI",           nameEn: "Samsung SDI",           market: "KR" },
  { ticker: "035720.KS", name: "카카오",            nameEn: "Kakao",                 market: "KR" },
  { ticker: "035420.KS", name: "NAVER",             nameEn: "Naver",                 market: "KR" },
  { ticker: "028260.KS", name: "삼성물산",           nameEn: "Samsung C&T",           market: "KR" },
  { ticker: "066570.KS", name: "LG전자",            nameEn: "LG Electronics",        market: "KR" },
  { ticker: "012330.KS", name: "현대모비스",         nameEn: "Hyundai Mobis",         market: "KR" },
  { ticker: "096770.KS", name: "SK이노베이션",       nameEn: "SK Innovation",         market: "KR" },
  { ticker: "030200.KS", name: "KT",                nameEn: "KT Corp",               market: "KR" },
  { ticker: "017670.KS", name: "SK텔레콤",          nameEn: "SK Telecom",            market: "KR" },
  { ticker: "034730.KS", name: "SK",                nameEn: "SK Inc",                market: "KR" },
  { ticker: "012450.KS", name: "한화에어로스페이스",  nameEn: "Hanwha Aerospace",      market: "KR" },
  { ticker: "010130.KS", name: "고려아연",           nameEn: "Korea Zinc",            market: "KR" },
  { ticker: "015760.KS", name: "한국전력",           nameEn: "KEPCO",                 market: "KR" },
  { ticker: "090430.KS", name: "아모레퍼시픽",       nameEn: "Amorepacific",          market: "KR" },
  { ticker: "011170.KS", name: "롯데케미칼",         nameEn: "Lotte Chemical",        market: "KR" },
  { ticker: "034020.KS", name: "두산에너빌리티",     nameEn: "Doosan Enerbility",     market: "KR" },
  { ticker: "003670.KS", name: "포스코퓨처엠",       nameEn: "POSCO Future M",        market: "KR" },
  { ticker: "000100.KS", name: "유한양행",           nameEn: "Yuhan Corp",            market: "KR" },
  // KOSDAQ
  { ticker: "247540.KQ", name: "에코프로비엠",       nameEn: "EcoPro BM",             market: "KR" },
  { ticker: "086520.KQ", name: "에코프로",           nameEn: "EcoPro",                market: "KR" },
  { ticker: "028300.KQ", name: "HLB",               nameEn: "HLB",                   market: "KR" },
  { ticker: "196170.KQ", name: "알테오젠",           nameEn: "Alteogen",              market: "KR" },
  { ticker: "058470.KQ", name: "리노공업",           nameEn: "Rino Industrial",       market: "KR" },
  { ticker: "011080.KQ", name: "레인보우로보틱스",    nameEn: "Rainbow Robotics",      market: "KR" },

  // ── 미국 주요 종목 ──────────────────────────────────────────────
  { ticker: "AAPL",  name: "애플",           nameEn: "Apple",             market: "US" },
  { ticker: "MSFT",  name: "마이크로소프트",   nameEn: "Microsoft",         market: "US" },
  { ticker: "NVDA",  name: "엔비디아",        nameEn: "Nvidia",            market: "US" },
  { ticker: "AMZN",  name: "아마존",          nameEn: "Amazon",            market: "US" },
  { ticker: "GOOGL", name: "알파벳(구글)",    nameEn: "Alphabet Google",   market: "US" },
  { ticker: "META",  name: "메타",            nameEn: "Meta",              market: "US" },
  { ticker: "TSLA",  name: "테슬라",          nameEn: "Tesla",             market: "US" },
  { ticker: "AVGO",  name: "브로드컴",        nameEn: "Broadcom",          market: "US" },
  { ticker: "TSM",   name: "TSMC",            nameEn: "Taiwan Semiconductor", market: "US" },
  { ticker: "JPM",   name: "JP모건",          nameEn: "JPMorgan Chase",    market: "US" },
  { ticker: "V",     name: "비자",            nameEn: "Visa",              market: "US" },
  { ticker: "MA",    name: "마스터카드",       nameEn: "Mastercard",        market: "US" },
  { ticker: "UNH",   name: "유나이티드헬스",   nameEn: "UnitedHealth",      market: "US" },
  { ticker: "LLY",   name: "일라이 릴리",      nameEn: "Eli Lilly",         market: "US" },
  { ticker: "JNJ",   name: "존슨앤존슨",       nameEn: "Johnson & Johnson", market: "US" },
  { ticker: "XOM",   name: "엑슨모빌",        nameEn: "Exxon Mobil",       market: "US" },
  { ticker: "NFLX",  name: "넷플릭스",        nameEn: "Netflix",           market: "US" },
  { ticker: "AMD",   name: "AMD",             nameEn: "Advanced Micro Devices", market: "US" },
  { ticker: "INTC",  name: "인텔",            nameEn: "Intel",             market: "US" },
  { ticker: "ORCL",  name: "오라클",          nameEn: "Oracle",            market: "US" },
  { ticker: "QCOM",  name: "퀄컴",            nameEn: "Qualcomm",          market: "US" },
  { ticker: "CRM",   name: "세일즈포스",       nameEn: "Salesforce",        market: "US" },
  { ticker: "PLTR",  name: "팔란티어",        nameEn: "Palantir",          market: "US" },
  { ticker: "COIN",  name: "코인베이스",       nameEn: "Coinbase",          market: "US" },
  { ticker: "SPOT",  name: "스포티파이",       nameEn: "Spotify",           market: "US" },
  { ticker: "RBLX",  name: "로블록스",        nameEn: "Roblox",            market: "US" },
  { ticker: "UBER",  name: "우버",            nameEn: "Uber",              market: "US" },
  { ticker: "ABNB",  name: "에어비앤비",       nameEn: "Airbnb",            market: "US" },
  { ticker: "PYPL",  name: "페이팔",          nameEn: "PayPal",            market: "US" },
  { ticker: "SQ",    name: "블록",            nameEn: "Block",             market: "US" },
  { ticker: "HOOD",  name: "로빈후드",        nameEn: "Robinhood",         market: "US" },
  { ticker: "ARM",   name: "ARM홀딩스",       nameEn: "ARM Holdings",      market: "US" },
  { ticker: "SMCI",  name: "슈퍼마이크로",     nameEn: "Super Micro",       market: "US" },
  { ticker: "MSTR",  name: "마이크로스트래티지", nameEn: "MicroStrategy",    market: "US" },
  { ticker: "IONQ",  name: "아이온큐",        nameEn: "IonQ",              market: "US" },
  { ticker: "RGTI",  name: "리게티컴퓨팅",     nameEn: "Rigetti Computing", market: "US" },

  // ── 지수 ────────────────────────────────────────────────────────
  { ticker: "^KS11",  name: "KOSPI",          nameEn: "KOSPI Index",       market: "INDEX" },
  { ticker: "^KQ11",  name: "KOSDAQ",         nameEn: "KOSDAQ Index",      market: "INDEX" },
  { ticker: "^GSPC",  name: "S&P 500",        nameEn: "SP500",             market: "INDEX" },
  { ticker: "^IXIC",  name: "나스닥",          nameEn: "NASDAQ Composite",  market: "INDEX" },
  { ticker: "^DJI",   name: "다우존스",        nameEn: "Dow Jones",         market: "INDEX" },
  { ticker: "^N225",  name: "닛케이225",       nameEn: "Nikkei 225",        market: "INDEX" },
  { ticker: "^HSI",   name: "항셍지수",        nameEn: "Hang Seng",         market: "INDEX" },
  { ticker: "^VIX",   name: "공포지수(VIX)",   nameEn: "VIX",               market: "INDEX" },

  // ── ETF ─────────────────────────────────────────────────────────
  { ticker: "QQQ",    name: "나스닥100 ETF",   nameEn: "Invesco QQQ",       market: "ETF" },
  { ticker: "SPY",    name: "S&P500 ETF",      nameEn: "SPDR SPY",          market: "ETF" },
  { ticker: "SOXX",   name: "반도체 ETF",      nameEn: "iShares SOXX",      market: "ETF" },
  { ticker: "ARKK",   name: "ARK 이노베이션",   nameEn: "ARK Innovation",    market: "ETF" },
  { ticker: "GLD",    name: "금 ETF",          nameEn: "SPDR Gold",         market: "ETF" },
  { ticker: "SOXL",   name: "반도체 3배 ETF",  nameEn: "Direxion SOXL",     market: "ETF" },
  { ticker: "TQQQ",   name: "나스닥 3배 ETF",  nameEn: "ProShares TQQQ",    market: "ETF" },

  // ── 선물 ────────────────────────────────────────────────────────
  { ticker: "NQ=F",   name: "나스닥100 선물",   nameEn: "NASDAQ 100 Futures", market: "FUTURES" },
  { ticker: "ES=F",   name: "S&P500 선물",     nameEn: "SP500 Futures",      market: "FUTURES" },
  { ticker: "YM=F",   name: "다우 선물",        nameEn: "Dow Futures",        market: "FUTURES" },
  { ticker: "GC=F",   name: "금 선물",          nameEn: "Gold Futures",       market: "FUTURES" },
  { ticker: "CL=F",   name: "WTI 원유 선물",   nameEn: "Crude Oil Futures",  market: "FUTURES" },
];

const MARKET_LABELS: Record<StockItem["market"], string> = {
  KR: "🇰🇷 국내",
  US: "🇺🇸 미국",
  INDEX: "📊 지수",
  ETF: "📦 ETF",
  FUTURES: "⚡ 선물",
};

export function searchStocks(query: string, limit = 8): StockItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return STOCK_LIST.filter(s =>
    s.ticker.toLowerCase().includes(q) ||
    s.name.includes(query) ||
    s.nameEn?.toLowerCase().includes(q)
  ).slice(0, limit);
}

export { MARKET_LABELS };
