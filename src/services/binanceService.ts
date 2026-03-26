import Binance from 'binance-api-node';

const apiKey = import.meta.env.VITE_BINANCE_API_KEY || ''; // Optional for public spot data
// binance-api-node disabled - browser incompatible
// export const binanceClient = Binance({
//   apiKey: apiKey || undefined,
// });

export async function fetchBinanceKlines(symbol: string, interval: string = '1d', limit: number = 365) {
  console.log('Binance klines disabled - returning mock');
  return null;
}

export async function fetchBinanceTicker(symbol: string) {
  console.log('Binance ticker disabled - returning null');
  return null;
}
