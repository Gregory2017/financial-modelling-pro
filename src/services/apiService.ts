import { fetchBinanceKlines, fetchBinanceTicker, fetchBinance24hrTicker, BinanceKline } from './binancePublic';
// Removed duplicate client - use finnhubClient from finnhubService

export interface StockData {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export interface QuoteData {
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  currency: string;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap?: number;
}

export interface WaccData {
  equity: number;
  debt: number;
  beta: number;
  re: number;
  rd: number;
  taxRate: number;
  riskFreeRate: number;
  marketReturn: number;
  isCrypto?: boolean;
}

export async function fetchStockData(ticker: string): Promise<StockData[]> {
  const upperTicker = ticker.toUpperCase();
  const isCrypto = upperTicker.includes('BTC') || upperTicker.includes('ETH') || upperTicker.includes('SOL');
  const symbol = isCrypto ? `${upperTicker}USDT` : upperTicker;

  try {
    if (isCrypto) {
      const klines = await fetchBinanceKlines(symbol, '1d', 365);
      if (!klines || klines.length === 0) return generateMockData(upperTicker);

      return klines.slice(-365).map((k: BinanceKline) => ({
        date: new Date(k.openTime).toISOString().split('T')[0],
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
        volume: parseFloat(k.volume),
      }));
    }

    const from = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
    const to = Math.floor(Date.now() / 1000);
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${import.meta.env.VITE_FINNHUB_API_KEY || ''}`
    );
    if (!response.ok) {
      console.warn('Finnhub failed:', response.status, '- using mock');
      return generateMockData(upperTicker);
    }
    const finnhubData = await response.json();
    if (finnhubData?.s !== 'ok' || !Array.isArray(finnhubData?.c) || finnhubData.c.length === 0) {
      console.warn('Finnhub no data - using mock');
      return generateMockData(upperTicker);
    }

    const data = finnhubData.c.map((close: number, i: number) => ({
      date: new Date(finnhubData.t[i] * 1000).toISOString().split('T')[0],
      open: finnhubData.o[i],
      high: finnhubData.h[i],
      low: finnhubData.l[i],
      close,
      volume: finnhubData.v[i],
    })).filter((d: StockData) =>
      Number.isFinite(d.open) &&
      Number.isFinite(d.high) &&
      Number.isFinite(d.low) &&
      Number.isFinite(d.close) &&
      Number.isFinite(d.volume)
    );

    return data.length > 0 ? data.slice(-365) : generateMockData(upperTicker);
  } catch (error) {
    console.error('Stock API failed:', error);
    return generateMockData(upperTicker);
  }

  function generateMockData(ticker: string): StockData[] {
    const basePrice = ticker === 'BTC' ? 65000 : 250;
    const data: StockData[] = [];
    let price = basePrice;
    const now = new Date();
    for (let i = 364; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      price *= 1 + (Math.random() - 0.5) * 0.02;
      data.push({
        date: date.toISOString().split('T')[0],
        open: price * (0.99 + Math.random() * 0.02),
        high: price * 1.02,
        low: price * 0.98,
        close: price,
        volume: Math.floor(1e6 + Math.random() * 5e6),
      });
    }
    return data;
  }
}

export async function fetchQuote(ticker: string): Promise<QuoteData | null> {
  const isCrypto = ticker.toUpperCase().includes('BTC') || ticker.toUpperCase().includes('ETH') || ticker.toUpperCase().includes('SOL');
  
  try {
    if (isCrypto) {
      const symbol = ticker.toUpperCase() + 'USDT';
      const [tickerData, stats24h] = await Promise.all([
        fetchBinanceTicker(symbol),
        fetchBinance24hrTicker(symbol),
      ]);

      if (!tickerData) return null;
      const price = parseFloat(tickerData.price);
      const changePercent = stats24h ? parseFloat(stats24h.priceChangePercent) : 0;
      const high = stats24h ? parseFloat(stats24h.highPrice) : price * 1.3;
      const low = stats24h ? parseFloat(stats24h.lowPrice) : price * 0.7;

      return {
        regularMarketPrice: price,
        regularMarketChangePercent: Number.isFinite(changePercent) ? changePercent : 0,
        currency: 'USDT',
        fiftyTwoWeekHigh: Number.isFinite(high) ? high : price * 1.3,
        fiftyTwoWeekLow: Number.isFinite(low) ? low : price * 0.7,
      };
    } else {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${import.meta.env.VITE_FINNHUB_API_KEY || ''}`
      );
      if (!response.ok) throw new Error(`Finnhub Quote API ${response.status}`);
      const q = await response.json();
      const quoteData = q ? {
        regularMarketPrice: q.c,
        regularMarketChangePercent: q.dp ?? 0,
        currency: 'USD',
        fiftyTwoWeekHigh: q.h || q.c * 1.3,
        fiftyTwoWeekLow: q.l || q.c * 0.7,
      } : null;
      if (!quoteData || !quoteData.regularMarketPrice) return null;
      return quoteData;
    }
  } catch (error) {
    console.error('Quote API failed:', error);
    return null;
  }
}

export async function fetchWaccData(ticker: string): Promise<WaccData> {
  const isCrypto = ticker.toUpperCase().includes('BTC') || ticker.toUpperCase().includes('ETH');
  
  if (isCrypto) {
    return {
      isCrypto: true,
      equity: 0,
      debt: 0,
      beta: 2.5, // Crypto beta higher
      re: 0.15,
      rd: 0,
      taxRate: 0,
      riskFreeRate: 0.045,
      marketReturn: 0.10
    };
  }
  
  try {
    const [profileRes, quoteRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker.toUpperCase()}&token=${import.meta.env.VITE_FINNHUB_API_KEY || ''}`),
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker.toUpperCase()}&token=${import.meta.env.VITE_FINNHUB_API_KEY || ''}`)
    ]);
    if (!profileRes.ok || !quoteRes.ok) throw new Error(`Finnhub WACC API ${profileRes.status}/${quoteRes.status}`);
    const profile = await profileRes.json();
    const quote = await quoteRes.json();

    const equity = (quote?.c || 0) * 1e6 || profile?.marketCapitalization || 0;
    const debt = profile?.totalDebt || 0;
    const beta = profile?.beta || 1.1;
    const riskFreeRate = 0.045;
    const marketReturn = 0.1;
    const taxRate = 0.21;
    const re = riskFreeRate + beta * (marketReturn - riskFreeRate);
    const rd = debt > 0 ? 0.05 : 0.05;

    return { equity, debt, beta, re, rd, taxRate, riskFreeRate, marketReturn };
  } catch (error) {
    console.error('WACC API failed:', error);
    throw error;
  }
}

export async function fetchFundamentals(ticker: string): Promise<any> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker.toUpperCase()}&token=${import.meta.env.VITE_FINNHUB_API_KEY || ''}`
    );
    if (!response.ok) throw new Error(`Finnhub Fundamentals API ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Fundamentals API failed:', error);
    return null;
  }
}

export async function fetchLiveMarketData(ticker: string) {
  return null;
}

export async function fetchMacroReport(): Promise<string | null> {
  return null;
}

