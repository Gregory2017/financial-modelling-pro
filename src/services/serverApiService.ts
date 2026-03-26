// Backend-compatible API service for server.ts - same logic as frontend
// Export functions for server use

import FinnhubApi from 'finnhub';
import Binance from 'binance-api-node';

const finnhubApiKey = process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY;
const finnhubClient = finnhubApiKey ? FinnhubApi({ apiKey: finnhubApiKey }) : null;

const binanceApiKey = process.env.BINANCE_API_KEY || process.env.VITE_BINANCE_API_KEY;
const binanceClient = Binance({
  apiKey: binanceApiKey || undefined,
});

export interface StockData {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

function isCrypto(ticker: string): boolean {
  const normalized = ticker.toUpperCase();
  const cryptoPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'AVAXUSDT', 'LTCUSDT', 'BCHUSDT', 'SHIBUSDT', 'UNIUSDT', 'NEARUSDT'];
  return cryptoPairs.some(pair => normalized === pair || normalized === pair.replace('USDT', '') || normalized.includes('-USDT'));
}

function normalizeTicker(ticker: string): string {
  const upper = ticker.toUpperCase().replace('.', '-');
  if (isCrypto(upper) && !upper.endsWith('USDT')) {
    return upper.replace('-USD', 'USDT').replace('USD', 'USDT');
  }
  return upper;
}

export async function fetchStockDataServer(ticker: string): Promise<StockData[]> {
  const symbol = normalizeTicker(ticker);
  const isCryptoFlag = isCrypto(symbol);
  const now = Math.floor(Date.now() / 1000);
  const yearAgo = now - (365 * 24 * 60 * 60);

  try {
    let rawData;
    if (isCryptoFlag) {
      const klines = await binanceClient.candles({ symbol, interval: '1d', limit: 365 });
      rawData = klines.map((k: any) => ({
        t: k.openTime,
        o: parseFloat(k.open),
        h: parseFloat(k.high),
        l: parseFloat(k.low),
        c: parseFloat(k.close),
        v: parseFloat(k.volume),
      }));
    } else if (finnhubClient) {
      rawData = await finnhubClient.stockCandles(symbol, 'D', yearAgo, now);
    } else {
      throw new Error('Finnhub not configured');
    }

    if (!rawData) throw new Error('No data');

    const data: StockData[] = [];
    if (isCryptoFlag) {
      (rawData as any[]).forEach((k: any) => {
        const date = new Date(k.t);
        data.push({
          date: date.toISOString(),
          open: k.o,
          high: k.h,
          low: k.l,
          close: k.c,
          volume: k.v,
        });
      });
    } else {
      const candle = rawData as any;
      for (let i = 0; i < (candle.t as number[]).length; i++) {
        const date = new Date((candle.t as number[])[i] * 1000);
        data.push({
          date: date.toISOString(),
          open: (candle.o as number[])[i],
          high: (candle.h as number[])[i],
          low: (candle.l as number[])[i],
          close: (candle.c as number[])[i],
          volume: (candle.v as number[])[i],
        });
      }
    }
    return data.filter(d => d.close > 0);
  } catch (error) {
    console.error(`fetchStockDataServer failed for ${ticker}:`, error);
    return [];
  }
}

// Similar for other functions...

export async function fetchQuoteServer(ticker: string) {
  // Implement similar logic
  return null;
}
