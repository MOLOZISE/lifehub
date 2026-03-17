/**
 * KIS (Korea Investment Securities) Open Trading API client
 * Docs: https://apiportal.koreainvestment.com
 */

const BASE_URL = "https://openapi.koreainvestment.com:9443";

const APP_KEY = process.env.KIS_APP_KEY ?? "";
const APP_SECRET = process.env.KIS_APP_SECRET ?? "";

// In-memory token cache (23h TTL — token expires in 24h)
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch(`${BASE_URL}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: APP_KEY,
      appsecret: APP_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIS 토큰 발급 실패: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };
  return cachedToken.token;
}

export interface StockPrice {
  ticker: string;
  name: string;
  price: number;
  change: number;      // 전일 대비 등락액
  changeRate: number;  // 등락률 (%)
  volume: number;
  marketCap?: number;
  high: number;
  low: number;
  open: number;
}

// 국내 주식 현재가 조회 (KOSPI/KOSDAQ)
export async function getKrPrice(ticker: string): Promise<StockPrice> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: ticker,
  });

  const res = await fetch(
    `${BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey: APP_KEY,
        appsecret: APP_SECRET,
        tr_id: "FHKST01010100",
        custtype: "P",
      },
    }
  );

  if (!res.ok) throw new Error(`KIS 국내 가격 조회 실패: ${ticker}`);

  const data = await res.json();
  const output = data.output;

  return {
    ticker,
    name: output.hts_kor_isnm,
    price: Number(output.stck_prpr),
    change: Number(output.prdy_vrss),
    changeRate: Number(output.prdy_ctrt),
    volume: Number(output.acml_vol),
    high: Number(output.stck_hgpr),
    low: Number(output.stck_lwpr),
    open: Number(output.stck_oprc),
  };
}

// 해외 주식 현재가 조회 (NASDAQ/NYSE)
// EXCD: NAS(나스닥), NYS(뉴욕), AMS(아멕스), HKS(홍콩), SHS(상해), SZS(심천)
export async function getUsPrice(ticker: string, excd = "NAS"): Promise<StockPrice> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    AUTH: "",
    EXCD: excd,
    SYMB: ticker,
  });

  const res = await fetch(
    `${BASE_URL}/uapi/overseas-price/v1/quotations/price?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey: APP_KEY,
        appsecret: APP_SECRET,
        tr_id: "HHDFS00000300",
        custtype: "P",
      },
    }
  );

  if (!res.ok) throw new Error(`KIS 해외 가격 조회 실패: ${ticker}`);

  const data = await res.json();
  const output = data.output;

  return {
    ticker,
    name: output.rsym ?? ticker,
    price: Number(output.last),
    change: Number(output.diff),
    changeRate: Number(output.rate),
    volume: Number(output.tvol),
    high: Number(output.high),
    low: Number(output.low),
    open: Number(output.open),
  };
}

// 자동 시장 판별: 숫자 6자리면 국내, 아니면 해외
export async function getPrice(ticker: string, market?: string): Promise<StockPrice> {
  const isKr = market === "KR" || /^\d{6}$/.test(ticker);
  if (isKr) {
    return getKrPrice(ticker);
  }
  // 미국 거래소 구분: 간단히 NAS 시도 후 NYS fallback은 호출 비용이 있으므로
  // market 필드에 NYS/NAS 등을 직접 받거나 기본 NAS 사용
  const excd = market === "NYS" ? "NYS" : market === "AMS" ? "AMS" : "NAS";
  return getUsPrice(ticker, excd);
}
