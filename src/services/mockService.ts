export interface StockData {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export async function fetchMockStockData(ticker: string): Promise<StockData[]> {
  console.log('Using mock data for', ticker);
  const data: StockData[] = [];
  let price = ticker === 'BTC' ? 65000 : ticker === 'TSLA' ? 250 : 100;
  const now = new Date();
  for (let i = 250; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    price *= 1 + (Math.random() - 0.5) * 0.02;
    data.push({
      date: date.toISOString().split('T')[0],
      open: price * (0.98 + Math.random() * 0.04),
      high: price * (1.01 + Math.random() * 0.03),
      low: price * (0.97 + Math.random() * 0.02),
      close: price,
      volume: Math.floor(1e6 + Math.random() * 9e6),
    });
  }
  return data;
}

export interface QuoteData {
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  currency: string;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}

export async function fetchMockQuote(ticker: string): Promise<QuoteData> {
  const price = ticker === 'BTC' ? 65000 : ticker === 'TSLA' ? 250 : 100;
  return {
    regularMarketPrice: price,
    regularMarketChangePercent: (Math.random() - 0.5) * 5,
    currency: 'USD',
    fiftyTwoWeekHigh: price * 1.3,
    fiftyTwoWeekLow: price * 0.7,
  };
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

export async function fetchMockWaccData(ticker: string): Promise<WaccData> {
  const isCrypto = ticker.toUpperCase().includes('BTC') || ticker.toUpperCase().includes('ETH');
  if (isCrypto) {
    return { isCrypto: true, equity: 0, debt: 0, beta: 0, re: 0, rd: 0, taxRate: 0, riskFreeRate: 0.045, marketReturn: 0.10 };
  }
  return {
    equity: 100e9,
    debt: 10e9,
    beta: 1.2,
    re: 0.105,
    rd: 0.045,
    taxRate: 0.21,
    riskFreeRate: 0.045,
    marketReturn: 0.10,
  };
}
