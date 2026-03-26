import express from "express";
import { createServer as createViteServer } from "vite";
import yahooFinance from 'yahoo-finance2';
import BinancePkg from 'binance-api-node';
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

// Init API clients
const finnhubApiKey = process.env.VITE_FINNHUB_API_KEY || '';
const binanceClient = (BinancePkg as any).default ? (BinancePkg as any).default() : (BinancePkg as any)();

// Helper to detect crypto
function isCryptoTicker(ticker: string): boolean {
  const cryptoTickers = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'SOL', 'DOGE', 'MATIC', 'LTC', 'AVAX', 'SOL'];
  return cryptoTickers.includes(ticker.toUpperCase());
}

async function createServer() {
  app.use(express.json());

  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/stock/:ticker", async (req, res) => {
    let { ticker } = req.params;
    ticker = ticker.toUpperCase();
    
    const isCrypto = isCryptoTicker(ticker);
    
    try {
      if (isCrypto) {
        // Use Binance for crypto
        const symbol = ticker + 'USDT';
        const klines = await binanceClient.candles({ symbol, interval: '1d', limit: 365 });
        
        if (!klines || klines.length === 0) {
          throw new Error('No data from Binance');
        }
        
        const formatted = klines.map((k: any) => ({
          date: new Date(k.openTime).toISOString(),
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: parseFloat(k.volume)
        }));
        
        return res.json(formatted);
      } else {
        // Use Finnhub REST for stocks
        if (!finnhubApiKey) {
          throw new Error('Finnhub not configured');
        }

        const now = Math.floor(Date.now() / 1000);
        const oneYearAgo = now - (365 * 24 * 60 * 60);
        const candleRes = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${oneYearAgo}&to=${now}&token=${finnhubApiKey}`
        );
        if (!candleRes.ok) {
          throw new Error(`Finnhub ${candleRes.status}`);
        }
        const candle: any = await candleRes.json();

        if (!candle || candle.s !== 'ok' || !Array.isArray(candle.c) || candle.c.length === 0) {
          throw new Error('No data from Finnhub');
        }

        const formatted = candle.c.map((close: number, index: number) => ({
          date: new Date(candle.t[index] * 1000).toISOString(),
          open: Number(candle.o[index]),
          high: Number(candle.h[index]),
          low: Number(candle.l[index]),
          close: Number(close),
          volume: Number(candle.v[index])
        }));

        return res.json(formatted);
      }
    } catch (error: any) {
      console.error(`Stock data error for ${ticker}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/quote/:ticker", async (req, res) => {
    let { ticker } = req.params;
    ticker = ticker.toUpperCase();
    
    try {
      const isCrypto = isCryptoTicker(ticker);
      
      if (isCrypto) {
        // Use Binance for crypto
        const symbol = ticker + 'USDT';
        const prices = await binanceClient.prices();
        const price = prices[symbol];
        
        if (!price) {
          throw new Error('No price from Binance');
        }
        
        const priceNum = parseFloat(price);
        
        return res.json({
          regularMarketPrice: priceNum,
          regularMarketChangePercent: 0,
          currency: 'USD',
          fiftyTwoWeekHigh: priceNum * 1.3,
          fiftyTwoWeekLow: priceNum * 0.7
        });
      } else {
        // Use Finnhub REST for stocks
        if (!finnhubApiKey) {
          throw new Error('Finnhub not configured');
        }

        const quoteRes = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubApiKey}`
        );
        if (!quoteRes.ok) {
          throw new Error(`Finnhub ${quoteRes.status}`);
        }
        const quote: any = await quoteRes.json();

        if (!quote || !quote.c) {
          throw new Error('No quote from Finnhub');
        }

        return res.json({
          regularMarketPrice: quote.c,
          regularMarketChangePercent: quote.dp || 0,
          currency: 'USD',
          fiftyTwoWeekHigh: quote.h || quote.c * 1.3,
          fiftyTwoWeekLow: quote.l || quote.c * 0.7
        });
      }
    } catch (error: any) {
      console.error(`Quote error for ${ticker}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/crypto-news", async (req, res) => {
    res.json({ news: null }); // Handled by frontend Gemini
  });

  app.get("/api/wacc/:ticker", async (req, res) => {
    let { ticker } = req.params;
    ticker = ticker.toUpperCase().replace('.', '-');
    const t = ticker;
    const isCrypto = t.endsWith("-USD") || t.includes("BTC") || t.includes("ETH") || t.includes("USDT") || t.includes("USDC") || t.includes("SOL") || t.includes("BNB");
    
    if (isCrypto) {
      return res.json({ isCrypto: true });
    }

    try {
      if (!finnhubApiKey) {
        throw new Error('Finnhub not configured');
      }

      const [profileRes, quoteRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubApiKey}`),
        fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubApiKey}`)
      ]);

      if (!profileRes.ok || !quoteRes.ok) {
        throw new Error(`Finnhub ${profileRes.status}/${quoteRes.status}`);
      }

      const profile: any = await profileRes.json();
      const quoteData: any = await quoteRes.json();

      const E = (quoteData.c || 0) * 1e6 || profile.marketCapitalization || 0; // c = current price
      const D = profile.totalDebt || 0;
      const beta = profile.beta || 1.1;
      const interestExpense = 0; // Finnhub limited - use default Rd

      
      const riskFreeRate = 0.045; // Updated to more current 10Y Treasury
      const marketReturn = 0.10;
      const taxRate = 0.21;

      const Re = riskFreeRate + beta * (marketReturn - riskFreeRate);
      const Rd = D > 0 ? interestExpense / D : 0.05; 

      res.json({
        equity: E,
        debt: D,
        beta: beta,
        re: Re,
        rd: Rd,
        taxRate: taxRate,
        riskFreeRate,
        marketReturn
      });
    } catch (error: any) {
      console.warn(`WACC API failed for ${ticker}, providing scaled fallback`);
      // Try to get at least the market cap for scaling
      let mktCap = 100e9;
      try {
        const q: any = await yahooFinance.quote(ticker);
        if (q.marketCap) mktCap = q.marketCap;
      } catch (e) {}

      res.json({
        equity: mktCap,
        debt: mktCap * 0.1,
        beta: 1.1,
        re: 0.10,
        rd: 0.05,
        taxRate: 0.21,
        riskFreeRate: 0.045,
        marketReturn: 0.10
      });
    }
  });

  app.get("/api/fundamentals/:ticker", async (req, res) => {
    let { ticker } = req.params;
    ticker = ticker.toUpperCase().replace('.', '-');
    try {
      const result: any = await yahooFinance.quoteSummary(ticker, { 
        modules: [ "incomeStatementHistory", "balanceSheetHistory", "cashflowStatementHistory" ] 
      });
      if (!result.incomeStatementHistory) throw new Error("No fundamentals");
      res.json(result);
    } catch (error: any) {
      console.warn(`Fundamentals API failed for ${ticker}, providing scaled fallback`);
      
      // Try to get current price for scaling mock data
      let price = 100;
      try {
        const q: any = await yahooFinance.quote(ticker);
        if (q.regularMarketPrice) price = q.regularMarketPrice;
      } catch (e) {}

      const years = ["2021", "2022", "2023", "2024", "2025"];
      const scale = price * 1e7; // Arbitrary scaling factor
      
      const mockFundamentals = {
        incomeStatementHistory: {
          incomeStatementHistory: years.map((year, i) => ({
            endDate: `${year}-12-31`,
            totalRevenue: { raw: scale * (10 + i * 2) },
            netIncome: { raw: scale * (2 + i * 0.5) }
          }))
        },
        balanceSheetHistory: {
          balanceSheetStatements: years.map((year, i) => ({
            endDate: `${year}-12-31`,
            totalAssets: { raw: scale * (20 + i * 4) },
            totalLiabilities: { raw: scale * (10 + i * 1) }
          }))
        },
        cashflowStatementHistory: {
          cashflowStatements: years.map((year, i) => ({
            endDate: `${year}-12-31`,
            totalCashFromOperatingActivities: { raw: scale * (3 + i * 0.8) },
            capitalExpenditures: { raw: -scale * (1 + i * 0.2) }
          }))
        }
      };
      res.json(mockFundamentals);
    }
  });

  // Advanced endpoint for Module A (S&P 500 sample)
  app.get("/api/sp500-sample", async (req, res) => {
    try {
      // Fetching 500 tickers is too much. Let's fetch a representative sample of 20
      const sampleTickers = ["AAPL", "MSFT", "AMZN", "GOOGL", "META", "BRK-B", "TSLA", "NVDA", "JPM", "V", "JNJ", "WMT", "PG", "MA", "UNH", "HD", "BAC", "DIS", "PFE", "KO"];
      
      const results = await Promise.all(
        sampleTickers.map(async (ticker) => {
          try {
            return await yahooFinance.historical(ticker, { period1: '2024-01-01', interval: '1d' });
          } catch (e) {
            return [];
          }
        })
      );
      
      res.json({ tickers: sampleTickers, data: results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/health", async (req, res) => {
    try {
      // Test yahoo-finance2 with a simple quote
      const test = await yahooFinance.quote('AAPL');
      res.json({ 
        status: "ok", 
        yahoo: test ? "ok" : "empty",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || "development"
      });
    } catch (e: any) {
      console.error("Health check Yahoo Finance test failed:", e.message);
      res.json({ 
        status: "ok", 
        yahoo: "failed", 
        error: e.message,
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || "development"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Manual fallback for dev mode to ensure index.html is served for SPA routes
    app.get("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) return next();
      try {
        const indexPath = path.resolve(__dirname, "index.html");
        if (!fs.existsSync(indexPath)) {
          console.error(`index.html not found at ${indexPath}`);
          return res.status(500).send("index.html missing");
        }
        const template = fs.readFileSync(indexPath, "utf-8");
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(transformed);
      } catch (e: any) {
        console.error("Vite transformIndexHtml error:", e.message);
        next(e);
      }
    });
  } else {
    console.log("Starting server in production mode...");
    app.use(express.static(path.resolve(__dirname, "dist")));
    // Catch-all route for SPA
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  return app;
}

// Only start the server if we're not in a serverless environment
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  createServer().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is listening on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  });
}

export default app;
