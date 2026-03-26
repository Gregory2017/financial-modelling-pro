import * as FinnhubModule from 'finnhub';

const apiKey = import.meta.env.VITE_FINNHUB_API_KEY || '';
if (!apiKey) {
  console.warn('VITE_FINNHUB_API_KEY not set - Finnhub data unavailable');
  export const finnhubClient = null;
} else {
  const Finnhub = FinnhubModule.default || FinnhubModule.Finnhub;
  export const finnhubClient = new Finnhub({ apiKey });
}

export interface FinnhubCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  t: number[];
  v: number[];
}

export async function fetchFinnhubCandle(symbol: string, resolution: string = 'D', from: number, to: number): Promise<FinnhubCandle | null> {
  if (!finnhubClient) return null;
  return new Promise((resolve, reject) => {
    (finnhubClient as any).stockCandles(symbol, resolution, from, to, (err: any, data: FinnhubCandle) => {
      if (err) {
        console.error(`Finnhub candle error for ${symbol}:`, err);
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

export interface FinnhubQuote {
  c: number;
  pc: number;
  h: number;
  l: number;
  dp: number;
}

export interface CompanyProfile2 {
  marketCapitalization: string;
  totalDebt: string;
  beta: string;
}

export async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
  if (!finnhubClient) return null;
  try {
    return await (finnhubClient as any).quote(symbol);
  } catch (error) {
    console.error(`Finnhub quote error for ${symbol}:`, error);
    return null;
  }
}

export async function fetchFinnhubProfile(symbol: string): Promise<CompanyProfile2 | null> {
  if (!finnhubClient) return null;
  try {
    return await (finnhubClient as any).companyProfile2({ symbol });
  } catch (error) {
    console.error(`Finnhub profile error for ${symbol}:`, error);
    return null;
  }
}

