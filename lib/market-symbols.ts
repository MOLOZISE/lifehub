export interface MarketItem {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changeRate: number;
  currency: string;
  type: "index" | "fx" | "commodity" | "stock" | "bond";
}

export const ALL_SYMBOLS: {
  symbol: string; label: string; currency: string;
  type: MarketItem["type"]; category: string; defaultOn: boolean;
}[] = [
  // 지수
  { symbol: "^IXIC",    label: "나스닥",        currency: "pt",  type: "index",     category: "지수",   defaultOn: true },
  { symbol: "^GSPC",    label: "S&P 500",       currency: "pt",  type: "index",     category: "지수",   defaultOn: true },
  { symbol: "^DJI",     label: "다우존스",       currency: "pt",  type: "index",     category: "지수",   defaultOn: true },
  { symbol: "^KS11",    label: "코스피",         currency: "pt",  type: "index",     category: "지수",   defaultOn: false },
  { symbol: "^KQ11",    label: "코스닥",         currency: "pt",  type: "index",     category: "지수",   defaultOn: false },
  { symbol: "^N225",    label: "닛케이",         currency: "pt",  type: "index",     category: "지수",   defaultOn: false },
  // 환율
  { symbol: "USDKRW=X", label: "원/달러",        currency: "KRW", type: "fx",        category: "환율",   defaultOn: true },
  { symbol: "EURUSD=X", label: "유로/달러",      currency: "USD", type: "fx",        category: "환율",   defaultOn: false },
  { symbol: "USDJPY=X", label: "달러/엔",        currency: "JPY", type: "fx",        category: "환율",   defaultOn: false },
  // 원자재
  { symbol: "CL=F",     label: "WTI 유가",       currency: "USD", type: "commodity", category: "원자재", defaultOn: true },
  { symbol: "GC=F",     label: "금",             currency: "USD", type: "commodity", category: "원자재", defaultOn: true },
  { symbol: "SI=F",     label: "은",             currency: "USD", type: "commodity", category: "원자재", defaultOn: false },
  { symbol: "BTC-USD",  label: "비트코인",        currency: "USD", type: "commodity", category: "원자재", defaultOn: false },
  // 주식
  { symbol: "MU",       label: "마이크론",        currency: "USD", type: "stock",     category: "주식",   defaultOn: true },
  { symbol: "WDC",      label: "웨스턴디지털",    currency: "USD", type: "stock",     category: "주식",   defaultOn: true },
  { symbol: "NVDA",     label: "엔비디아",        currency: "USD", type: "stock",     category: "주식",   defaultOn: false },
  { symbol: "AAPL",     label: "애플",            currency: "USD", type: "stock",     category: "주식",   defaultOn: false },
  { symbol: "TSLA",     label: "테슬라",          currency: "USD", type: "stock",     category: "주식",   defaultOn: false },
  // 채권
  { symbol: "^TNX",     label: "미국 10년채",     currency: "%",   type: "bond",      category: "채권",   defaultOn: false },
  { symbol: "^TYX",     label: "미국 30년채",     currency: "%",   type: "bond",      category: "채권",   defaultOn: false },
];

export const DEFAULT_SYMBOLS = ALL_SYMBOLS.filter(s => s.defaultOn).map(s => s.symbol);
