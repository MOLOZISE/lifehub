/**
 * KIS (Korea Investment Securities) Open Trading API client
 * Docs: https://apiportal.koreainvestment.com
 */

const BASE_URL = "https://openapi.koreainvestment.com:9443";

const APP_KEY = process.env.KIS_APP_KEY ?? "";
const APP_SECRET = process.env.KIS_APP_SECRET ?? "";

// In-memory token cache (23h TTL — token expires in 24h)
let cachedToken: { token: string; expiresAt: number } | null = null;
// 진행 중인 토큰 발급 요청 — 병렬 호출 시 중복 발급 방지 (KIS: 분당 1회 제한)
let tokenFetchPromise: Promise<string> | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  // 이미 발급 중이면 같은 프로미스를 공유
  if (tokenFetchPromise) return tokenFetchPromise;

  tokenFetchPromise = (async () => {
    try {
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
        const body = await res.json().catch(() => ({}));
        const desc = body?.error_description ?? `HTTP ${res.status}`;
        throw new Error(`KIS 인증 실패: ${desc}`);
      }

      const data = await res.json();
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + 23 * 60 * 60 * 1000,
      };
      return cachedToken.token;
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
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

// 국내 지수 현재가 (코스피: "0001", 코스닥: "1001")
export async function getKrIndex(indexCode: string): Promise<StockPrice> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "U",
    FID_INPUT_ISCD: indexCode,
  });
  const res = await fetch(
    `${BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-index-price?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey: APP_KEY,
        appsecret: APP_SECRET,
        tr_id: "FHPUP02100000",
        custtype: "P",
      },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) throw new Error(`KIS 국내지수 조회 실패: ${indexCode}`);
  const data = await res.json();
  const o = data.output;
  const price = Number(o.bstp_nmix_prpr ?? o.ovrs_nmix_prpr ?? 0);
  const change = Number(o.bstp_nmix_prdy_vrss ?? o.ovrs_nmix_prdy_vrss ?? 0);
  const changeRate = Number(o.bstp_nmix_prdy_ctrt ?? o.ovrs_nmix_prdy_ctrt ?? 0);
  return {
    ticker: indexCode,
    name: o.hts_kor_isnm ?? indexCode,
    price, change, changeRate,
    volume: Number(o.acml_vol ?? 0),
    high: Number(o.bstp_nmix_hgpr ?? 0),
    low: Number(o.bstp_nmix_lwpr ?? 0),
    open: Number(o.bstp_nmix_oprc ?? 0),
  };
}

// 해외 지수 현재가 (나스닥: "N0100", S&P500: "N0300", 다우: "N0400")
export async function getUsIndex(indexCode: string): Promise<StockPrice> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "N",
    FID_INPUT_ISCD: indexCode,
  });
  const res = await fetch(
    `${BASE_URL}/uapi/overseas-price/v1/quotations/inquire-index-price?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey: APP_KEY,
        appsecret: APP_SECRET,
        tr_id: "HHDFS76200200",
        custtype: "P",
      },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) throw new Error(`KIS 해외지수 조회 실패: ${indexCode}`);
  const data = await res.json();
  const o = data.output;
  const price = Number(o.ovrs_nmix_prpr ?? o.bstp_nmix_prpr ?? 0);
  const change = Number(o.ovrs_nmix_prdy_vrss ?? o.bstp_nmix_prdy_vrss ?? 0);
  const changeRate = Number(o.ovrs_nmix_prdy_ctrt ?? o.bstp_nmix_prdy_ctrt ?? 0);
  return {
    ticker: indexCode,
    name: o.hts_kor_isnm ?? indexCode,
    price, change, changeRate,
    volume: 0,
    high: Number(o.ovrs_nmix_hgpr ?? 0),
    low: Number(o.ovrs_nmix_lwpr ?? 0),
    open: Number(o.ovrs_nmix_oprc ?? 0),
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
