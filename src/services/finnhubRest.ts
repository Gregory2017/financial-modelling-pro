const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || '';
const BASE_URL = 'https://finnhub.io/api/v1';

export interface FinnhubCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
}

export interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  pc: number;
}

export interface CompanyProfile {
  marketCapitalization: number;
  totalDebt: number;
  beta: number;
}

async function finnhubFetch(endpoint: string): Promise<any> {
  if (!API_KEY) {
    console.warn('Finnhub key missing');
    return null;
  }
  try {
    const response = await fetch(`${BASE_URL}${endpoint}&token=${API_KEY}`);
    if (!response.ok) {
      console.error(`Finnhub ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Finnhub fetch error:', error);
    return null;
  }
}

export async function fetchFinnhubCandle(symbol: string, from: number, to: number): Promise<FinnhubCandle | null> {
  return finnhubFetch(`/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}`);
}

export async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
  return finnhubFetch(`/quote?symbol=${symbol}`);
}

export async function fetchFinnhubProfile(symbol: string): Promise<CompanyProfile | null> {
  return finnhubFetch(`/stock/profile2?symbol=${symbol}`);
}

