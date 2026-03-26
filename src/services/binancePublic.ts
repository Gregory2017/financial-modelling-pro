export interface Binance24hrStats {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  count: number;
}

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  count: number;
  takerBuyBase: string;
  takerBuyQuote: string;
}

export async function fetchBinanceKlines(symbol: string = 'BTCUSDT', interval: string = '1d', limit: number = 365): Promise<BinanceKline[] | null> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!response.ok) throw new Error(`Binance ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Binance klines error for ${symbol}:`, error);
    return null;
  }
}

export async function fetchBinanceTicker(symbol: string = 'BTCUSDT'): Promise<{ price: string } | null> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    if (!response.ok) throw new Error(`Binance ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Binance ticker error for ${symbol}:`, error);
    return null;
  }
}

export async function fetchBinance24hrTicker(symbol: string = 'BTCUSDT'): Promise<Binance24hrStats | null> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!response.ok) throw new Error(`Binance 24hr ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Binance 24hr ticker error for ${symbol}:`, error);
    return null;
  }
}

export async function fetchBinance24hrStats(symbol: string = 'BTCUSDT'): Promise<{ priceChangePercent: string } | null> {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!response.ok) throw new Error(`Binance 24hr ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Binance 24hr ticker error for ${symbol}:`, error);
    return null;
  }
}

