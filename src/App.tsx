import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ScatterChart, Scatter, ZAxis, AreaChart, Area, ComposedChart,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, PieChart as PieChartIcon, BarChart3, 
  Settings, Search, RefreshCw, ChevronRight, Info, AlertTriangle, CheckCircle2
} from 'lucide-react';
import * as ss from 'simple-statistics';
import { 
  blackScholesCall, blackScholesPut, calculateMACD, calculateRSI, 
  calculateMarkovPrediction, calculateSMA, calculateTailRisk, detectCrosses
} from './services/financeService';
import { fetchLiveMarketData, fetchMacroReport } from './services/geminiService';
import { fetchStockData, fetchQuote, fetchWaccData, fetchFundamentals } from './services/apiService';

// --- Types ---
interface StockData {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

interface FundamentalData {
  incomeStatementHistory: { incomeStatementHistory: any[] };
  balanceSheetHistory: { balanceSheetStatements: any[] };
  cashflowStatementHistory: { cashflowStatements: any[] };
}

interface WaccData {
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

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const Card = ({ title, children, className = "" }: any) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {title && (
      <div className="px-6 py-4 border-bottom border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">{title}</h3>
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const StatBox = ({ label, value, trend, icon: Icon, subValue }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
        <Icon size={24} />
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
    {subValue && <p className="text-[10px] font-medium text-slate-400 mt-2 italic">{subValue}</p>}
  </div>
);

// --- Main App ---

export default function App() {
  const [activeModule, setActiveModule] = useState('F'); // Default to Price Movement
  const [ticker, setTicker] = useState('TSLA');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StockData[]>([]);
  const [fundamentals, setFundamentals] = useState<FundamentalData | null>(null);
  const [waccData, setWaccData] = useState<WaccData | null>(null);
  const [cryptoNews, setCryptoNews] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Module B State
  const [bsParams, setBsParams] = useState({
    S: 250, // Default for TSLA
    K: 260,
    r: 0.0425,
    T: 0.1333,
    sigma: 0.1823,
    d: 0.0383
  });

  const [quote, setQuote] = useState<any>(null);
  const [geminiPrice, setGeminiPrice] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchData = async (t: string) => {
    setLoading(true);
    setError(null);
    setCryptoNews(null);
    setGeminiPrice(null);
    
    // Start Gemini verification immediately (optional - only works with API key)
    verifyPrice(t);

    try {
      // Fetch all data using the apiService (direct calls with CORS proxy)
      const [stockData, waccDataResult, fundamentalsData, quoteData] = await Promise.all([
        fetchStockData(t),
        fetchWaccData(t),
        fetchFundamentals(t),
        fetchQuote(t)
      ]);

      if (!stockData || stockData.length === 0) {
        throw new Error('Failed to fetch stock data');
      }
      
      // Set quote data
      if (quoteData) {
        setQuote((prev: any) => {
          const newQuote = { ...quoteData };
          if (quoteData.regularMarketPrice) {
            setBsParams(p => ({ ...p, S: quoteData.regularMarketPrice }));
          }
          return newQuote;
        });
      }
      
      // Format stock data
      const formattedData = stockData.map((d: any) => ({
        date: new Date(d.date).toLocaleDateString(),
        close: d.close,
        open: d.open,
        high: d.high,
        low: d.low,
        volume: d.volume
      }));
      
      setData(formattedData);

      // Set WACC data
      setWaccData(waccDataResult);
      
      if (waccDataResult.isCrypto) {
        fetchMacroReport().then(setCryptoNews);
      } else if (fundamentalsData) {
        setFundamentals(fundamentalsData);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyPrice = async (t: string) => {
    setIsVerifying(true);
    const marketData = await fetchLiveMarketData(t);
    if (marketData && marketData.price) {
      setGeminiPrice(marketData.price);
      
      setQuote(prev => {
        // If we already have a Yahoo quote, we just augment it with Gemini data
        // We don't overwrite the Yahoo price unless it's missing
        const updated = {
          ...prev,
          geminiVerifiedPrice: marketData.price,
          sentiment: marketData.sentiment,
          lastUpdated: marketData.lastUpdated,
          source: prev?.regularMarketPrice ? 'Yahoo Finance + Gemini Verified' : 'Gemini AI Oracle (Live Search)'
        };
        
        if (!updated.regularMarketPrice) {
          updated.regularMarketPrice = marketData.price;
          updated.regularMarketChangePercent = marketData.changePercent;
          updated.currency = marketData.currency;
          setBsParams(p => ({ ...p, S: marketData.price }));
        }
        
        return updated;
      });
    }
    setIsVerifying(false);
  };

  useEffect(() => {
    fetchData(ticker);
  }, []);

  const handleTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(ticker);
  };

  // Calculations for modules
  const prices = data.map(d => d.close);
  const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
  
  const macdData = calculateMACD(prices);
  const rsiData = calculateRSI(prices);
  const ema50 = calculateSMA(prices, 50);
  const sma200 = calculateSMA(prices, 200);
  const sma3y = calculateSMA(prices, 200); // Using 200 for demo if 3y is too long
  const markov = calculateMarkovPrediction(prices, ema50, sma3y);
  const tailRisk = returns.length > 0 ? calculateTailRisk(returns) : null;
  const crosses = detectCrosses(ema50, sma200);

  const chartData = data.map((d, i) => ({
    ...d,
    macd: macdData.macd[i],
    signal: macdData.signal[i],
    histogram: macdData.histogram[i],
    rsi: rsiData[i],
    ema50: ema50[i],
    sma200: sma200[i],
    sma3y: sma3y[i],
    golden: crosses.golden[i] ? d.close : null,
    death: crosses.death[i] ? d.close : null
  })).slice(-100); // Show last 100 points for clarity

  // Fundamental Chart Data
  const revenueData = fundamentals?.incomeStatementHistory?.incomeStatementHistory?.map((item: any) => ({
    date: item.endDate ? new Date(item.endDate).getFullYear() : 'N/A',
    revenue: (item.totalRevenue?.raw || 0) / 1e9,
    netIncome: (item.netIncome?.raw || 0) / 1e9
  })) || [];

  const balanceData = fundamentals?.balanceSheetHistory?.balanceSheetStatements?.map((item: any) => ({
    date: item.endDate ? new Date(item.endDate).getFullYear() : 'N/A',
    assets: (item.totalAssets?.raw || 0) / 1e9,
    liabilities: (item.totalLiabilities?.raw || 0) / 1e9
  })) || [];

  const cashflowData = fundamentals?.cashflowStatementHistory?.cashflowStatements?.map((item: any) => ({
    date: item.endDate ? new Date(item.endDate).getFullYear() : 'N/A',
    fcf: ((item.totalCashFromOperatingActivities?.raw || 0) + (item.capitalExpenditures?.raw || 0)) / 1e9
  })) || [];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 p-6 flex flex-col">
        <div className="flex items-center space-x-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Activity size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight leading-tight">Financial Modelling Pro</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem icon={BarChart3} label="Price Movement" active={activeModule === 'F'} onClick={() => setActiveModule('F')} />
          <SidebarItem icon={PieChartIcon} label="Fundamental Analysis" active={activeModule === 'FUND'} onClick={() => setActiveModule('FUND')} />
          <SidebarItem icon={Activity} label="WACC Metric" active={activeModule === 'WACC'} onClick={() => setActiveModule('WACC')} />
          <SidebarItem icon={Activity} label="Technical Indicators" active={activeModule === 'DE'} onClick={() => setActiveModule('DE')} />
          <SidebarItem icon={TrendingUp} label="Markov Prediction" active={activeModule === 'G'} onClick={() => setActiveModule('G')} />
          <SidebarItem icon={PieChartIcon} label="Tail Risk Analysis" active={activeModule === 'A'} onClick={() => setActiveModule('A')} />
          <SidebarItem icon={Settings} label="Option Pricing" active={activeModule === 'B'} onClick={() => setActiveModule('B')} />
          <SidebarItem icon={RefreshCw} label="Volatility Report" active={activeModule === 'C'} onClick={() => setActiveModule('C')} />
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Current Ticker</p>
            <form onSubmit={handleTickerSubmit} className="relative">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-3 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Enter ticker..."
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                <Search size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-1">
              {activeModule === 'F' && 'Market Overview'}
              {activeModule === 'FUND' && 'Fundamental Analysis'}
              {activeModule === 'WACC' && 'WACC Metric'}
              {activeModule === 'DE' && 'Technical Analysis'}
              {activeModule === 'G' && 'Predictive Modeling'}
              {activeModule === 'A' && 'Risk Assessment'}
              {activeModule === 'B' && 'Option Calculator'}
              {activeModule === 'C' && 'Volatility Metrics'}
            </h2>
            <p className="text-slate-500 font-medium">Analyzing {ticker} performance and risk metrics</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString()}</p>
              <p className="text-xs font-medium text-slate-500">Market Open</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl flex items-center space-x-4">
            <AlertTriangle size={24} />
            <div>
              <p className="font-bold">Error loading data</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Module F: Price Movement */}
            {activeModule === 'F' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="relative">
                    <StatBox 
                      label="Current Price" 
                      value={`${quote?.currency === 'USD' || !quote?.currency ? '$' : quote.currency + ' '}${(quote?.regularMarketPrice || prices[prices.length - 1] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                      trend={quote?.regularMarketChangePercent?.toFixed(2) || (prices.length >= 2 ? ((prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2] * 100).toFixed(2) : "0.00")} 
                      icon={TrendingUp} 
                      subValue={quote?.sentiment ? `Sentiment: ${quote.sentiment}` : undefined}
                    />
                    <div className="absolute top-2 right-2 flex flex-col items-end space-y-1">
                      {isVerifying ? (
                        <div className="flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 border border-slate-200">
                          <RefreshCw size={10} className="animate-spin" />
                          <span>Verifying Live...</span>
                        </div>
                      ) : quote?.geminiVerifiedPrice ? (
                        <div className="flex items-center space-x-1 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-600 border border-emerald-100 shadow-sm">
                          <CheckCircle2 size={10} />
                          <span>AI VERIFIED: ${quote.geminiVerifiedPrice.toLocaleString()}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <StatBox label="52W High" value={`$${(quote?.fiftyTwoWeekHigh || Math.max(...prices)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={Activity} />
                  <StatBox label="52W Low" value={`$${(quote?.fiftyTwoWeekLow || Math.min(...prices)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={TrendingDown} />
                </div>
                <Card title="Price History (1 Year)">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" hide />
                        <YAxis domain={['auto', 'auto']} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </>
            )}

            {/* Module WACC: WACC Metric */}
            {activeModule === 'WACC' && waccData && (
              <div className="space-y-8">
                <Card title="WACC Formula & Calculation">
                  <div className="flex flex-col items-center justify-center py-10 bg-slate-900 rounded-2xl text-white overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                      <div className="absolute top-10 left-10 text-4xl font-mono">Re = Rf + β(Rm - Rf)</div>
                      <div className="absolute bottom-10 right-10 text-4xl font-mono">V = E + D</div>
                    </div>
                    
                    <div className="text-center mb-12">
                      <p className="text-indigo-400 font-mono text-sm uppercase tracking-widest mb-4">Weighted Average Cost of Capital</p>
                      <div className="text-4xl md:text-6xl font-serif italic tracking-tight flex items-center justify-center space-x-4">
                        <span>WACC</span>
                        <span>=</span>
                        <div className="flex flex-col items-center">
                          <span className="border-b border-white/30 px-2 pb-1">E</span>
                          <span className="pt-1">V</span>
                        </div>
                        <span className="text-indigo-400">×</span>
                        <span>Re</span>
                        <span className="text-2xl font-sans font-normal mx-2">+</span>
                        <div className="flex flex-col items-center">
                          <span className="border-b border-white/30 px-2 pb-1">D</span>
                          <span className="pt-1">V</span>
                        </div>
                        <span className="text-indigo-400">×</span>
                        <span>Rd</span>
                        <span className="text-indigo-400">×</span>
                        <span>(1 - Tc)</span>
                      </div>
                    </div>

                    {!waccData.isCrypto ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-4xl px-6">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-white">
                            {((waccData.equity / (waccData.equity + waccData.debt)) * waccData.re + (waccData.debt / (waccData.equity + waccData.debt)) * waccData.rd * (1 - waccData.taxRate) * 100).toFixed(2)}%
                          </p>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-1">Calculated WACC</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-indigo-400">{(waccData.re * 100).toFixed(2)}%</p>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-1">Cost of Equity (Re)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-rose-400">{(waccData.rd * 100).toFixed(2)}%</p>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-1">Cost of Debt (Rd)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-slate-300">{waccData.beta.toFixed(2)}</p>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-1">Beta (β)</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center px-6">
                        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-300 text-sm font-medium">
                          <Info size={16} />
                          <span>WACC is not applicable for Cryptocurrencies</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {!waccData.isCrypto && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card title="Capital Structure">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip 
                              formatter={(value: number) => [`$${(value / 1e9).toFixed(2)}B`, 'Value']}
                            />
                            <Legend />
                            <Pie
                              data={[
                                { name: 'Equity', value: waccData.equity },
                                { name: 'Debt', value: waccData.debt }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              <Cell fill="#6366f1" />
                              <Cell fill="#f43f5e" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        </div>
                      </Card>
                      <Card title="WACC Components Details">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <span className="text-sm font-medium text-slate-600">Market Cap (E)</span>
                            <span className="font-bold text-slate-900">${(waccData.equity / 1e9).toFixed(2)}B</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <span className="text-sm font-medium text-slate-600">Total Debt (D)</span>
                            <span className="font-bold text-slate-900">${(waccData.debt / 1e9).toFixed(2)}B</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <span className="text-sm font-medium text-slate-600">Risk-Free Rate (Rf)</span>
                            <span className="font-bold text-slate-900">{(waccData.riskFreeRate * 100).toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <span className="text-sm font-medium text-slate-600">Market Return (Rm)</span>
                            <span className="font-bold text-slate-900">{(waccData.marketReturn * 100).toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <span className="text-sm font-medium text-slate-600">Tax Rate (Tc)</span>
                            <span className="font-bold text-slate-900">{(waccData.taxRate * 100).toFixed(2)}%</span>
                          </div>
                        </div>
                      </Card>
                  </div>
                )}
              </div>
            )}

            {/* Module FUND: Fundamental Analysis */}
            {activeModule === 'FUND' && (
              <div className="space-y-8">
                {waccData?.isCrypto ? (
                  <Card title="Macroeconomic Crypto Report">
                    <div className="prose prose-slate max-w-none">
                      {cryptoNews ? (
                        <div className="markdown-body">
                          <Markdown>{cryptoNews}</Markdown>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                          <RefreshCw className="animate-spin mb-4" size={32} />
                          <p>Generating macroeconomic report...</p>
                        </div>
                      )}
                    </div>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <Card title="Revenue & Net Income (Billion USD)">
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={revenueData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" />
                              <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={{ r: 6 }} />
                              <Line type="monotone" dataKey="netIncome" stroke="#10b981" strokeWidth={3} dot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                      <Card title="Assets & Liabilities (Billion USD)">
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={balanceData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" />
                              <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="assets" fill="#6366f1" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="liabilities" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    </div>
                    <Card title="Free Cash Flow (Billion USD)">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={cashflowData}>
                            <defs>
                              <linearGradient id="colorFcf" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" />
                            <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Area type="monotone" dataKey="fcf" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorFcf)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* Module DE: Technical Indicators */}
            {activeModule === 'DE' && (
              <div className="space-y-8">
                <Card title="Golden Cross & Death Cross (SMA 50/200)">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" hide />
                        <YAxis domain={['auto', 'auto']} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="close" stroke="#94a3b8" dot={false} strokeWidth={1} opacity={0.5} />
                        <Line type="monotone" dataKey="ema50" name="SMA 50" stroke="#6366f1" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="sma200" name="SMA 200" stroke="#f59e0b" dot={false} strokeWidth={2} />
                        <Scatter dataKey="golden" name="Golden Cross" fill="#10b981" />
                        <Scatter dataKey="death" name="Death Cross" fill="#f43f5e" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="MACD (Moving Average Convergence Divergence)">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" hide />
                        <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="top" height={36}/>
                        <Bar dataKey="histogram" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="macd" stroke="#6366f1" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="signal" stroke="#f43f5e" dot={false} strokeWidth={2} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="RSI (Relative Strength Index)">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" hide />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="rsi" stroke="#8b5cf6" dot={false} strokeWidth={2} />
                        {/* Threshold lines */}
                        <Line type="monotone" dataKey={() => 70} stroke="#f43f5e" strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey={() => 30} stroke="#10b981" strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            )}

            {/* Module G: Markov Prediction */}
            {activeModule === 'G' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Markov State Probabilities">
                  <div className="flex flex-col items-center justify-center h-full py-10">
                    <div className="flex space-x-12 mb-10">
                      <div className="text-center">
                        <div className="w-32 h-32 rounded-full border-8 border-emerald-500 flex items-center justify-center mb-4">
                          <span className="text-2xl font-bold text-emerald-600">{(markov.probU * 100).toFixed(1)}%</span>
                        </div>
                        <p className="font-bold text-slate-900">U (Growth)</p>
                      </div>
                      <div className="text-center">
                        <div className="w-32 h-32 rounded-full border-8 border-rose-500 flex items-center justify-center mb-4">
                          <span className="text-2xl font-bold text-rose-600">{(markov.probD * 100).toFixed(1)}%</span>
                        </div>
                        <p className="font-bold text-slate-900">D (Decline)</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl w-full">
                      <p className="text-sm font-medium text-slate-500 mb-2">Current Market State</p>
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${markov.lastState === 'U' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        <p className="text-lg font-bold text-slate-900">
                          {markov.lastState === 'U' ? 'Bullish Impulse (EMA50 > SMA3Y)' : 'Bearish Impulse (EMA50 < SMA3Y)'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
                <Card title="EMA50 vs SMA3Y Trend">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" hide />
                        <YAxis domain={['auto', 'auto']} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="close" stroke="#94a3b8" dot={false} strokeWidth={1} opacity={0.5} />
                        <Line type="monotone" dataKey="ema50" stroke="#6366f1" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="sma3y" stroke="#f59e0b" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            )}

            {/* Module A: Tail Risk */}
            {activeModule === 'A' && tailRisk && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatBox label="95% Hist. VaR" value={`${(tailRisk.varHist * 100).toFixed(2)}%`} icon={AlertTriangle} />
                  <StatBox label="95% Hist. CVaR" value={`${(tailRisk.cvarHist * 100).toFixed(2)}%`} icon={AlertTriangle} />
                  <StatBox label="Hill Alpha (α)" value={tailRisk.hillAlpha.toFixed(2)} icon={Activity} />
                  <StatBox label="Tail Observations" value={tailRisk.tail.length} icon={BarChart3} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card title="Log-Log Tail Distribution">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis type="number" dataKey="x" name="log10(|Return|)" label={{ value: 'log10(|Return|)', position: 'insideBottom', offset: -10 }} />
                          <YAxis type="number" dataKey="y" name="log10(Rank)" label={{ value: 'log10(Rank)', angle: -90, position: 'insideLeft' }} />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                          <Scatter name="Tail" data={tailRisk.tail.map((val, i) => ({ x: Math.log10(val), y: Math.log10(tailRisk.tail.length - i) }))} fill="#6366f1" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                  <Card title="Risk Metrics Comparison">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                        <span className="font-medium text-slate-600">Historical VaR</span>
                        <span className="font-bold text-slate-900">{(tailRisk.varHist * 100).toFixed(4)}%</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                        <span className="font-medium text-slate-600">Historical CVaR</span>
                        <span className="font-bold text-slate-900">{(tailRisk.cvarHist * 100).toFixed(4)}%</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                        <span className="font-medium text-slate-600">Normal VaR</span>
                        <span className="font-bold text-slate-900">{(tailRisk.varNorm * 100).toFixed(4)}%</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                        <span className="font-medium text-slate-600">Normal CVaR</span>
                        <span className="font-bold text-slate-900">{(tailRisk.cvarNorm * 100).toFixed(4)}%</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Module B: Option Pricing */}
            {activeModule === 'B' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card title="Calculator Inputs" className="lg:col-span-1">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Spot Price (S)</label>
                      <input type="number" value={bsParams.S} onChange={e => setBsParams({...bsParams, S: parseFloat(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Strike Price (K)</label>
                      <input type="number" value={bsParams.K} onChange={e => setBsParams({...bsParams, K: parseFloat(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Risk-Free Rate (r)</label>
                      <input type="number" step="0.0001" value={bsParams.r} onChange={e => setBsParams({...bsParams, r: parseFloat(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Time to Expiry (T, years)</label>
                      <input type="number" step="0.0001" value={bsParams.T} onChange={e => setBsParams({...bsParams, T: parseFloat(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Volatility (σ)</label>
                      <input type="number" step="0.0001" value={bsParams.sigma} onChange={e => setBsParams({...bsParams, sigma: parseFloat(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Dividend Yield (d)</label>
                      <input type="number" step="0.0001" value={bsParams.d} onChange={e => setBsParams({...bsParams, d: parseFloat(e.target.value)})} className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold" />
                    </div>
                  </div>
                </Card>
                <div className="lg:col-span-2 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card title="Call Option Price">
                      <div className="text-center py-6">
                        <p className="text-4xl font-bold text-indigo-600 mb-2">
                          {quote?.currency === 'USD' || !quote?.currency ? '$' : quote.currency + ' '}{blackScholesCall(bsParams.S, bsParams.K, bsParams.T, bsParams.r, bsParams.sigma).price.toFixed(4)}
                        </p>
                        <p className="text-sm font-medium text-slate-500">Theoretical Value</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                        <div><span className="text-slate-400">d1:</span> <span className="font-bold">{blackScholesCall(bsParams.S, bsParams.K, bsParams.T, bsParams.r, bsParams.sigma).d1.toFixed(4)}</span></div>
                        <div><span className="text-slate-400">d2:</span> <span className="font-bold">{blackScholesCall(bsParams.S, bsParams.K, bsParams.T, bsParams.r, bsParams.sigma).d2.toFixed(4)}</span></div>
                      </div>
                    </Card>
                    <Card title="Put Option Price">
                      <div className="text-center py-6">
                        <p className="text-4xl font-bold text-rose-600 mb-2">
                          {quote?.currency === 'USD' || !quote?.currency ? '$' : quote.currency + ' '}{blackScholesPut(bsParams.S, bsParams.K, bsParams.T, bsParams.r, bsParams.d, bsParams.sigma).price.toFixed(4)}
                        </p>
                        <p className="text-sm font-medium text-slate-500">Theoretical Value</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                        <div><span className="text-slate-400">d1:</span> <span className="font-bold">{blackScholesPut(bsParams.S, bsParams.K, bsParams.T, bsParams.r, bsParams.d, bsParams.sigma).d1.toFixed(4)}</span></div>
                        <div><span className="text-slate-400">d2:</span> <span className="font-bold">{blackScholesPut(bsParams.S, bsParams.K, bsParams.T, bsParams.r, bsParams.d, bsParams.sigma).d2.toFixed(4)}</span></div>
                      </div>
                    </Card>
                  </div>
                  <Card title="Sensitivity Analysis (Greeks Placeholder)">
                    <div className="flex items-center justify-center h-32 text-slate-400 italic">
                      Delta, Gamma, Theta, and Vega metrics would be displayed here in a production environment.
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Module C: Volatility Report */}
            {activeModule === 'C' && (
              <div className="space-y-8">
                <Card title="Realized Volatility Report">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="p-6 bg-indigo-50 rounded-2xl">
                        <p className="text-sm font-bold text-indigo-400 uppercase mb-1">Annualized Volatility</p>
                        <p className="text-5xl font-black text-indigo-600">{(returns.length > 1 ? ss.standardDeviation(returns) * Math.sqrt(252) * 100 : 0).toFixed(2)}%</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white border border-slate-200 rounded-xl">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Daily Vol</p>
                          <p className="text-xl font-bold text-slate-900">{(returns.length > 1 ? ss.standardDeviation(returns) * 100 : 0).toFixed(4)}%</p>
                        </div>
                        <div className="p-4 bg-white border border-slate-200 rounded-xl">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Observations</p>
                          <p className="text-xl font-bold text-slate-900">{returns.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900">Volatility Insights</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        The realized volatility measures the actual price fluctuations observed over the selected period. 
                        An annualized volatility of <strong>{(returns.length > 1 ? ss.standardDeviation(returns) * Math.sqrt(252) * 100 : 0).toFixed(2)}%</strong> 
                        indicates the standard deviation of the asset's returns over a one-year horizon.
                      </p>
                      <div className="pt-4">
                        <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-lg text-xs font-bold">
                          <Info size={14} />
                          <span>Calculated using log returns and 252 trading days assumption.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                <Card title="Daily Returns Distribution">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={returns.map(r => ({ r: r * 100 }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="r" hide />
                        <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="r" fill="#6366f1" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
