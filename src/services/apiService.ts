import { GoogleGenAI, Type } from "@google/genai";

// Multiple CORS proxies for Yahoo Finance (free, no API key needed)
const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://proxy.corsfix.io/?",
];

function getProxyUrl(url: string): string {
  // Try first proxy, if it fails we'll handle it in the fetch
  return CORS_PROXIES[0] + encodeURIComponent(url);
}

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

// Yahoo Finance via query1.finance.yahoo.com with multiple proxy fallback
async function fetchWithProxy(url: string, maxRetries = 3): Promise<any> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    const proxy = CORS_PROXIES[i % CORS_PROXIES.length];
    const proxyUrl = proxy + encodeURIComponent(url);
    
    try {
      const response = await fetch(proxyUrl, { 
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn(`Proxy ${proxy} failed:`, error);
      lastError = error;
    }
  }
  throw lastError || new Error("All proxies failed");
}

async function fetchYahooFinance(query: string): Promise<any> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(query)}?interval=1d&range=1y`;
  return fetchWithProxy(url);
}

async function fetchYahooQuote(query: string): Promise<any> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(query)}`;
  return fetchWithProxy(url);
}

async function fetchYahooSummary(query: string, modules: string): Promise<any> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(query)}?modules=${modules}`;
  return fetchWithProxy(url);
}

// Normalize ticker
function normalizeTicker(ticker: string): { ticker: string; isCrypto: boolean } {
  let t = ticker.toUpperCase().replace('.', '-');
  const cryptoSymbols = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "DOT", "LINK", "MATIC", "AVAX", "LTC", "BCH", "SHIB", "DAI", "UNI", "PEPE", "NEAR", "ICP"];
  const isCrypto = cryptoSymbols.includes(t) || t.endsWith("USD") || t.includes("-USD");
  if (isCrypto && !t.includes("-")) t = `${t}-USD`;
  return { ticker: t, isCrypto };
}

// Get stock data
export async function fetchStockData(ticker: string): Promise<StockData[]> {
  const { ticker: normalized, isCrypto } = normalizeTicker(ticker);
  
  try {
    const data = await fetchYahooFinance(normalized);
    const result = data.chart?.result?.[0];
    if (!result) throw new Error("No data");
    
    const quotes = result.timestamp.map((timestamp: number, i: number) => ({
      date: new Date(timestamp * 1000).toISOString(),
      close: result.indicators?.quote?.[0]?.close?.[i] || 0,
      open: result.indicators?.quote?.[0]?.open?.[i] || 0,
      high: result.indicators?.quote?.[0]?.high?.[i] || 0,
      low: result.indicators?.quote?.[0]?.low?.[i] || 0,
      volume: result.indicators?.quote?.[0]?.volume?.[i] || 0
    })).filter((q: any) => q.close !== null);
    
    return quotes;
  } catch (error) {
    console.warn("Yahoo Finance failed, generating mock data:", error);
    return generateMockData(ticker);
  }
}

// Get quote data
export async function fetchQuote(ticker: string): Promise<QuoteData | null> {
  const { ticker: normalized } = normalizeTicker(ticker);
  
  try {
    const data = await fetchYahooQuote(normalized);
    const quote = data.quoteResponse?.result?.[0];
    if (!quote) return null;
    return {
      regularMarketPrice: quote.regularMarketPrice || 0,
      regularMarketChangePercent: quote.regularMarketChangePercent || 0,
      currency: quote.currency || "USD",
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
      marketCap: quote.marketCap
    };
  } catch (error) {
    console.warn("Yahoo Quote failed:", error);
    return null;
  }
}

// Get WACC data
export async function fetchWaccData(ticker: string): Promise<WaccData> {
  const { ticker: normalized, isCrypto } = normalizeTicker(ticker);
  
  if (isCrypto) {
    return { isCrypto: true, equity: 0, debt: 0, beta: 0, re: 0, rd: 0, taxRate: 0, riskFreeRate: 0.045, marketReturn: 0.10 };
  }
  
  try {
    const [quoteData, summaryData] = await Promise.all([
      fetchYahooQuote(normalized),
      fetchYahooSummary(normalized, "financialData,defaultKeyStatistics,summaryDetail")
    ]);
    
    const quote = quoteData.quoteResponse?.result?.[0];
    const summary = summaryData.quoteSummary?.result?.[0];
    
    const E = quote?.marketCap || summary?.summaryDetail?.marketCap?.raw || 0;
    const D = summary?.financialData?.totalDebt?.raw || 0;
    const beta = summary?.defaultKeyStatistics?.beta?.raw || summary?.summaryDetail?.beta?.raw || 1.1;
    const interestExpense = Math.abs(summary?.incomeStatementHistory?.incomeStatementHistory?.[0]?.interestExpense?.raw || 0);
    
    const riskFreeRate = 0.045;
    const marketReturn = 0.10;
    const taxRate = 0.21;
    const Re = riskFreeRate + beta * (marketReturn - riskFreeRate);
    const Rd = D > 0 ? interestExpense / D : 0.05;
    
    return { equity: E, debt: D, beta, re: Re, rd: Rd, taxRate, riskFreeRate, marketReturn };
  } catch (error) {
    console.warn("WACC fetch failed, using defaults:", error);
    return {
      equity: 100e9, debt: 10e9, beta: 1.1, re: 0.10, rd: 0.05, taxRate: 0.21, riskFreeRate: 0.045, marketReturn: 0.10
    };
  }
}

// Get fundamentals
export async function fetchFundamentals(ticker: string): Promise<any> {
  const { ticker: normalized, isCrypto } = normalizeTicker(ticker);
  
  if (isCrypto) return null;
  
  try {
    const data = await fetchYahooSummary(normalized, "incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory");
    const result = data.quoteSummary?.result?.[0];
    if (!result?.incomeStatementHistory) throw new Error("No fundamentals");
    return result;
  } catch (error) {
    console.warn("Fundamentals fetch failed:", error);
    return null;
  }
}

// Gemini AI for live price verification
export async function fetchLiveMarketData(ticker: string) {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not set");
      return null;
    }
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Search for the real-time market data for ${ticker}. Provide the current price, the 24h percentage change, the currency, and a brief 1-sentence market sentiment.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER },
            changePercent: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            sentiment: { type: Type.STRING },
            lastUpdated: { type: Type.STRING }
          },
          required: ["price", "changePercent", "currency"]
        }
      },
    });
    
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Market Data Error:", error);
    return null;
  }
}

export async function fetchMacroReport(): Promise<string | null> {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!apiKey) return null;
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Provide a brief macroeconomic report (2-3 paragraphs) about current market conditions.",
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text || null;
  } catch (error) {
    console.error("Gemini Macro Report failed:", error);
    return null;
  }
}

// Generate mock data as fallback
function generateMockData(ticker: string): StockData[] {
  const data: StockData[] = [];
  let price = 100;
  if (ticker.toUpperCase().includes("BTC")) price = 90000;
  else if (ticker.toUpperCase().includes("ETH")) price = 2500;
  else if (ticker.toUpperCase().includes("TSLA")) price = 250;
  else if (ticker.toUpperCase().includes("AAPL")) price = 180;
  else if (ticker.toUpperCase().includes("NVDA")) price = 500;
  
  for (let i = 200; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    price *= 1 + (Math.random() - 0.5) * 0.04;
    data.push({
      date: date.toISOString(),
      close: price,
      open: price * (1 - Math.random() * 0.01),
      high: price * (1 + Math.random() * 0.02),
      low: price * (1 - Math.random() * 0.02),
      volume: Math.floor(Math.random() * 10000000)
    });
  }
  return data;
}

