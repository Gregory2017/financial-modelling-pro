import * as ss from 'simple-statistics';

/**
 * Module B: Black-Scholes Option Pricing
 */
export function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): { price: number; d1: number; d2: number; Nd1: number; Nd2: number } {
  if (sigma <= 0 || T <= 0) return { price: NaN, d1: NaN, d2: NaN, Nd1: NaN, Nd2: NaN };

  const d1 = (Math.log(S / K) + (r + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const Nd1 = ss.cumulativeStdNormalProbability(d1);
  const Nd2 = ss.cumulativeStdNormalProbability(d2);

  const price = S * Nd1 - K * Math.exp(-r * T) * Nd2;
  return { price, d1, d2, Nd1, Nd2 };
}

export function blackScholesPut(S: number, K: number, T: number, r: number, d: number, sigma: number): { price: number; d1: number; d2: number; Nnegd1: number; Nnegd2: number } {
  if (sigma <= 0 || T <= 0) return { price: NaN, d1: NaN, d2: NaN, Nnegd1: NaN, Nnegd2: NaN };

  const d1 = (Math.log(S / K) + (r - d + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const Nnegd1 = ss.cumulativeStdNormalProbability(-d1);
  const Nnegd2 = ss.cumulativeStdNormalProbability(-d2);

  const price = K * Math.exp(-r * T) * Nnegd2 - S * Math.exp(-d * T) * Nnegd1;
  return { price, d1, d2, Nnegd1, Nnegd2 };
}

/**
 * Module D: MACD Calculation
 */
export function calculateMACD(prices: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macd = ema12.map((v, i) => v - ema26[i]);
  const signal = calculateEMA(macd, 9);
  const histogram = macd.map((v, i) => v - signal[i]);

  return { macd, signal, histogram };
}

function calculateEMA(data: number[], period: number): number[] {
  if (!data || data.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = new Array(data.length).fill(0);
  ema[0] = data[0] || 0;
  for (let i = 1; i < data.length; i++) {
    ema[i] = (data[i] || 0) * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/**
 * Module E: RSI Calculation
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi = new Array(prices.length).fill(NaN);
  if (prices.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsi[period] = 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = 100 - (100 / (1 + avgGain / avgLoss));
  }

  return rsi;
}

/**
 * Module G: Markov Model Prediction
 */
export function calculateMarkovPrediction(prices: number[], ema50: number[], sma3y: number[]): { probU: number; probD: number; lastState: string } {
  const states: string[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (isNaN(ema50[i]) || isNaN(sma3y[i])) continue;
    states.push(ema50[i] > sma3y[i] ? 'U' : 'D');
  }

  if (states.length < 2) return { probU: 0.5, probD: 0.5, lastState: 'U' };

  const transitions: Record<string, Record<string, number>> = {
    U: { U: 0, D: 0 },
    D: { U: 0, D: 0 }
  };

  for (let i = 1; i < states.length; i++) {
    const from = states[i - 1];
    const to = states[i];
    transitions[from][to]++;
  }

  const lastState = states[states.length - 1];
  const totalFromLast = transitions[lastState].U + transitions[lastState].D;
  
  if (totalFromLast === 0) return { probU: 0.5, probD: 0.5, lastState };

  return {
    probU: transitions[lastState].U / totalFromLast,
    probD: transitions[lastState].D / totalFromLast,
    lastState
  };
}

export function calculateSMA(data: number[], period: number): number[] {
  const sma = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma[i] = sum / period;
  }
  return sma;
}

export function detectCrosses(sma50: number[], sma200: number[]): { golden: boolean[]; death: boolean[] } {
  const golden = new Array(sma50.length).fill(false);
  const death = new Array(sma50.length).fill(false);

  for (let i = 1; i < sma50.length; i++) {
    if (isNaN(sma50[i]) || isNaN(sma200[i]) || isNaN(sma50[i-1]) || isNaN(sma200[i-1])) continue;

    // Golden Cross: SMA50 crosses ABOVE SMA200
    if (sma50[i] > sma200[i] && sma50[i - 1] <= sma200[i - 1]) {
      golden[i] = true;
    }
    // Death Cross: SMA50 crosses BELOW SMA200
    if (sma50[i] < sma200[i] && sma50[i - 1] >= sma200[i - 1]) {
      death[i] = true;
    }
  }

  return { golden, death };
}

/**
 * Module A: Tail Risk (VaR, CVaR)
 */
export function calculateTailRisk(returns: number[], confidence: number = 0.95) {
  if (returns.length === 0) return null;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);
  
  const varHist = sortedReturns[index];
  const cvarHist = sortedReturns.slice(0, index + 1).reduce((a, b) => a + b, 0) / (index + 1);

  const mu = ss.mean(returns);
  const sigma = ss.standardDeviation(returns);
  
  // Normal VaR: mu + sigma * norm.ppf(1 - confidence)
  // norm.ppf is inverse of CDF. We can use a simple approximation or library.
  // simple-statistics doesn't have ppf, but we can use a lookup or approximation.
  const z = -1.645; // for 95% confidence
  const varNorm = mu + sigma * z;
  
  // CVaR Normal: mu - sigma * pdf(ppf(confidence)) / confidence
  const pdfZ = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * Math.pow(z, 2));
  const cvarNorm = mu - sigma * (pdfZ / (1 - confidence));

  // Hill Estimator
  const absReturns = returns.map(r => Math.abs(r)).filter(r => r > 0);
  const threshold = ss.quantile(absReturns, 0.9);
  const tail = absReturns.filter(r => r >= threshold).sort((a, b) => a - b);
  const xMin = tail[0];
  const hillAlpha = 1 / (tail.reduce((acc, x) => acc + Math.log(x / xMin), 0) / tail.length);

  return {
    varHist,
    cvarHist,
    varNorm,
    cvarNorm,
    hillAlpha,
    tail
  };
}
