export interface StockMeta {
  ticker: string;
  name: string;
  market: "KR" | "US";
  sector: string;
}

// 국내 인기 종목 (KOSPI/KOSDAQ 시총 상위)
export const KR_POPULAR: StockMeta[] = [
  { ticker: "005930", name: "삼성전자", market: "KR", sector: "semiconductor" },
  { ticker: "000660", name: "SK하이닉스", market: "KR", sector: "semiconductor" },
  { ticker: "005380", name: "현대차", market: "KR", sector: "consumer" },
  { ticker: "035420", name: "NAVER", market: "KR", sector: "tech" },
  { ticker: "051910", name: "LG화학", market: "KR", sector: "materials" },
  { ticker: "006400", name: "삼성SDI", market: "KR", sector: "tech" },
  { ticker: "035720", name: "카카오", market: "KR", sector: "tech" },
  { ticker: "003550", name: "LG", market: "KR", sector: "industrial" },
  { ticker: "207940", name: "삼성바이오로직스", market: "KR", sector: "healthcare" },
  { ticker: "068270", name: "셀트리온", market: "KR", sector: "healthcare" },
  { ticker: "105560", name: "KB금융", market: "KR", sector: "finance" },
  { ticker: "055550", name: "신한지주", market: "KR", sector: "finance" },
  { ticker: "086790", name: "하나금융지주", market: "KR", sector: "finance" },
  { ticker: "032830", name: "삼성생명", market: "KR", sector: "finance" },
  { ticker: "009150", name: "삼성전기", market: "KR", sector: "semiconductor" },
  { ticker: "066570", name: "LG전자", market: "KR", sector: "tech" },
  { ticker: "028260", name: "삼성물산", market: "KR", sector: "industrial" },
  { ticker: "096770", name: "SK이노베이션", market: "KR", sector: "energy" },
  { ticker: "030200", name: "KT", market: "KR", sector: "communication" },
  { ticker: "017670", name: "SK텔레콤", market: "KR", sector: "communication" },
  { ticker: "011200", name: "HMM", market: "KR", sector: "industrial" },
  { ticker: "010130", name: "고려아연", market: "KR", sector: "materials" },
  { ticker: "012330", name: "현대모비스", market: "KR", sector: "consumer" },
  { ticker: "000270", name: "기아", market: "KR", sector: "consumer" },
  { ticker: "034220", name: "LG디스플레이", market: "KR", sector: "tech" },
  { ticker: "042660", name: "한화오션", market: "KR", sector: "industrial" },
  { ticker: "010950", name: "S-Oil", market: "KR", sector: "energy" },
  { ticker: "009540", name: "HD한국조선해양", market: "KR", sector: "industrial" },
  { ticker: "259960", name: "크래프톤", market: "KR", sector: "tech" },
  { ticker: "352820", name: "하이브", market: "KR", sector: "communication" },
  { ticker: "041510", name: "에스엠", market: "KR", sector: "communication" },
  { ticker: "047050", name: "포스코인터내셔널", market: "KR", sector: "industrial" },
  { ticker: "005490", name: "POSCO홀딩스", market: "KR", sector: "materials" },
  { ticker: "006360", name: "GS건설", market: "KR", sector: "industrial" },
  { ticker: "018260", name: "삼성에스디에스", market: "KR", sector: "tech" },
  { ticker: "251270", name: "넷마블", market: "KR", sector: "tech" },
  { ticker: "036570", name: "엔씨소프트", market: "KR", sector: "tech" },
  { ticker: "293490", name: "카카오게임즈", market: "KR", sector: "tech" },
  { ticker: "373220", name: "LG에너지솔루션", market: "KR", sector: "tech" },
  { ticker: "000100", name: "유한양행", market: "KR", sector: "healthcare" },
  { ticker: "326030", name: "SK바이오팜", market: "KR", sector: "healthcare" },
  { ticker: "196170", name: "알테오젠", market: "KR", sector: "healthcare" },
  { ticker: "247540", name: "에코프로비엠", market: "KR", sector: "materials" },
  { ticker: "086280", name: "현대글로비스", market: "KR", sector: "industrial" },
  { ticker: "003490", name: "대한항공", market: "KR", sector: "industrial" },
  { ticker: "030000", name: "제일기획", market: "KR", sector: "communication" },
  { ticker: "000810", name: "삼성화재", market: "KR", sector: "finance" },
  { ticker: "139480", name: "이마트", market: "KR", sector: "consumer" },
  { ticker: "161390", name: "한국타이어앤테크놀로지", market: "KR", sector: "consumer" },
  { ticker: "316140", name: "우리금융지주", market: "KR", sector: "finance" },
];

// 미국 인기 종목 (S&P500/나스닥 상위)
export const US_POPULAR: StockMeta[] = [
  { ticker: "AAPL", name: "Apple", market: "US", sector: "tech" },
  { ticker: "MSFT", name: "Microsoft", market: "US", sector: "tech" },
  { ticker: "NVDA", name: "NVIDIA", market: "US", sector: "semiconductor" },
  { ticker: "AMZN", name: "Amazon", market: "US", sector: "tech" },
  { ticker: "GOOGL", name: "Alphabet (Google)", market: "US", sector: "tech" },
  { ticker: "META", name: "Meta Platforms", market: "US", sector: "tech" },
  { ticker: "TSLA", name: "Tesla", market: "US", sector: "consumer" },
  { ticker: "BRK.B", name: "Berkshire Hathaway", market: "US", sector: "finance" },
  { ticker: "LLY", name: "Eli Lilly", market: "US", sector: "healthcare" },
  { ticker: "JPM", name: "JPMorgan Chase", market: "US", sector: "finance" },
  { ticker: "V", name: "Visa", market: "US", sector: "finance" },
  { ticker: "UNH", name: "UnitedHealth", market: "US", sector: "healthcare" },
  { ticker: "XOM", name: "ExxonMobil", market: "US", sector: "energy" },
  { ticker: "MA", name: "Mastercard", market: "US", sector: "finance" },
  { ticker: "JNJ", name: "Johnson & Johnson", market: "US", sector: "healthcare" },
  { ticker: "PG", name: "Procter & Gamble", market: "US", sector: "consumer" },
  { ticker: "HD", name: "Home Depot", market: "US", sector: "consumer" },
  { ticker: "AVGO", name: "Broadcom", market: "US", sector: "semiconductor" },
  { ticker: "MRK", name: "Merck", market: "US", sector: "healthcare" },
  { ticker: "COST", name: "Costco", market: "US", sector: "consumer" },
  { ticker: "ABBV", name: "AbbVie", market: "US", sector: "healthcare" },
  { ticker: "AMD", name: "AMD", market: "US", sector: "semiconductor" },
  { ticker: "NFLX", name: "Netflix", market: "US", sector: "communication" },
  { ticker: "CRM", name: "Salesforce", market: "US", sector: "tech" },
  { ticker: "BAC", name: "Bank of America", market: "US", sector: "finance" },
  { ticker: "ORCL", name: "Oracle", market: "US", sector: "tech" },
  { ticker: "CVX", name: "Chevron", market: "US", sector: "energy" },
  { ticker: "WMT", name: "Walmart", market: "US", sector: "consumer" },
  { ticker: "KO", name: "Coca-Cola", market: "US", sector: "consumer" },
  { ticker: "PEP", name: "PepsiCo", market: "US", sector: "consumer" },
  { ticker: "ADBE", name: "Adobe", market: "US", sector: "tech" },
  { ticker: "TMO", name: "Thermo Fisher", market: "US", sector: "healthcare" },
  { ticker: "INTC", name: "Intel", market: "US", sector: "semiconductor" },
  { ticker: "QCOM", name: "Qualcomm", market: "US", sector: "semiconductor" },
  { ticker: "DIS", name: "Disney", market: "US", sector: "communication" },
  { ticker: "IBM", name: "IBM", market: "US", sector: "tech" },
  { ticker: "GE", name: "GE Aerospace", market: "US", sector: "industrial" },
  { ticker: "F", name: "Ford", market: "US", sector: "consumer" },
  { ticker: "GM", name: "General Motors", market: "US", sector: "consumer" },
  { ticker: "PLTR", name: "Palantir", market: "US", sector: "tech" },
  { ticker: "SHOP", name: "Shopify", market: "US", sector: "tech" },
  { ticker: "SNOW", name: "Snowflake", market: "US", sector: "tech" },
  { ticker: "UBER", name: "Uber", market: "US", sector: "tech" },
  { ticker: "SPOT", name: "Spotify", market: "US", sector: "communication" },
  { ticker: "COIN", name: "Coinbase", market: "US", sector: "finance" },
  { ticker: "SOFI", name: "SoFi Technologies", market: "US", sector: "finance" },
  { ticker: "RIVN", name: "Rivian", market: "US", sector: "consumer" },
  { ticker: "ARM", name: "Arm Holdings", market: "US", sector: "semiconductor" },
  { ticker: "SMCI", name: "Super Micro Computer", market: "US", sector: "tech" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF", market: "US", sector: "etf" },
];

export const ALL_POPULAR = [...KR_POPULAR, ...US_POPULAR];

export function searchStocks(query: string, market?: "KR" | "US"): StockMeta[] {
  if (!query.trim()) {
    return market ? ALL_POPULAR.filter(s => s.market === market) : ALL_POPULAR;
  }
  const q = query.toLowerCase().replace(/\s/g, "");
  const list = market ? ALL_POPULAR.filter(s => s.market === market) : ALL_POPULAR;
  return list.filter(
    s =>
      s.ticker.toLowerCase().startsWith(q) ||
      s.name.toLowerCase().replace(/\s/g, "").includes(q)
  );
}
