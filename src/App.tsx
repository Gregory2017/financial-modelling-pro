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
import { fetchStockData, fetchQuote, fetchWaccData, fetchFundamentals } from './services/apiService';

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
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
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

export default function App() {
  const [activeModule, setActiveModule] = useState('F');
  const [ticker, setTicker] = useState('TSLA');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StockData[]>([]);
  const [fundamentals, setFundamentals] = useState<FundamentalData | null>(null);
  const [waccData, setWaccData] = useState<WaccData | null>(null);
  const [cryptoNews, setCryptoNews] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Option Pricing state
  const [bsParams, setBsParams] = useState({
    S: 250,
    K: 260,
    r: 0.0425,
    T: 0.1333,
    sigma: 0.1823,
    d: 0.0383
  });

  const [quote, setQuote] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchData = async (t: string) => {
    setLoading(true);
    setError(null);
    setCryptoNews(null);
    
    try {
      const [stockData, waccDataResult, fundamentalsData, quoteData] = await Promise.all([
        fetchStockData(t),
        fetchWaccData(t),
        fetchFundamentals(t),
        fetchQuote(t)
      ]);

      if (!stockData || stockData.length === 0) {
        throw new Error('Failed to fetch stock data');
      }
      
      setData(stockData.map((d: any) => ({
        date: new Date(d.date).toLocaleDateString(),
        close: d.close,
        open: d.open,
        high: d.high,
        low: d.low,
        volume: d.volume
      })));
      
      setWaccData(waccDataResult);
      
      if (fundamentalsData) {
        setFundamentals(fundamentalsData);
      }

      if (quoteData) {
        setQuote(quoteData);
        if (quoteData.regularMarketPrice) {
          setBsParams(p => ({ ...p, S: quoteData.regularMarketPrice }));
        }
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(ticker);
  }, []);

  const handleTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(ticker);
  };

  const prices = data.map(d => d.close);
  const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
  
  const macdData = calculateMACD(prices);
  const rsiData = calculateRSI(prices);
  const ema50 = calculateSMA(prices, 50);
  const sma200 = calculateSMA(prices, 200);
  const markov = calculateMarkovPrediction(prices, ema50, sma200);
  const tailRisk = returns.length > 0 ? calculateTailRisk(returns) : null;
  const crosses = detectCrosses(ema50, sma200);

  const chartData = data.map((d, i) => ({
    ...d,
    macd: macdData.macd[i],
    signal: macdData.signal[i],
    rsi: rsiData[i],
    ema50: ema50[i],
    sma200: sma200[i],
  })).slice(-100);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <aside className="w-72 bg-white border-r border-slate-200 p-6 flex flex-col">
        <div className="flex items-center space-x-3 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Activity size={24} />
          </div>
          <h1 className="text-xl font-bold">Financial Modelling Pro</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem icon={BarChart3} label="Price Movement" active={activeModule === 'F'} onClick={() => setActiveModule('F')} />
          <SidebarItem icon={PieChartIcon} label="Fundamental Analysis" active={activeModule === 'FUND'} onClick={() => setActiveModule('FUND')} />
          <SidebarItem icon={Activity} label="WACC Metric" active={activeModule === 'WACC'} onClick={() => setActiveModule('WACC')} />
          <SidebarItem icon={TrendingUp} label="Markov Prediction" active={activeModule === 'G'} onClick={() => setActiveModule('G')} />
          <SidebarItem icon={PieChartIcon} label="Tail Risk" active={activeModule === 'A'} onClick={() => setActiveModule('A')} />
          <SidebarItem icon={Settings} label="Option Pricing" active={activeModule === 'B'} onClick={() => setActiveModule('B')} />
        </nav>

        <div className="mt-auto pt-6 border-t">
          <form onSubmit={handleTickerSubmit} className="relative">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-3 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter ticker (TSLA, AAPL, BTC)..."
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
              <Search size={16} />
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-1">
              {activeModule === 'F' && 'Market Overview'}
              {activeModule === 'WACC' && 'WACC Analysis'}
              {activeModule === 'FUND' && 'Fundamentals'}
            </h2>
            <p className="text-slate-500">Ticker: {ticker}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
            <p className="text-xs text-slate-500">Live Data</p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 p-6 rounded-2xl">
            <AlertTriangle size={24} className="text-red-500" />
            <p className="mt-2 font-bold text-red-900">{error}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Price Chart */}
            {activeModule === 'F' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <StatBox 
                    label="Current Price" 
                    value={`$${(quote?.regularMarketPrice || prices[prices.length - 1] || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
                    trend={quote?.regularMarketChangePercent || 0} 
                    icon={TrendingUp} 
                  />
                  <StatBox label="Volume" value={data[data.length - 1]?.volume?.toLocaleString() || 'N/A'} icon={Activity} />
                  <StatBox label="Beta" value={waccData?.beta?.toFixed(2) || 'N/A'} icon={TrendingDown} />
                </div>
                <Card title="Price Chart (1Y)">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={3} fill="url(#colorPrice)" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* WACC */}
            {activeModule === 'WACC' && waccData && (
              <div>
                <Card title="WACC Calculation">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center p-8 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl">
                    <div>
                      <p className="text-4xl font-black text-indigo-600">
                        {((waccData.equity / (waccData.equity + waccData.debt)) * waccData.re + (waccData.debt / (waccData.equity + waccData.debt)) * waccData.rd * (1 - waccData.taxRate) * 100).toFixed(2)}%
                      </p>
                      <p className="text-sm font-bold text-slate-600 uppercase mt-2">WACC</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{(waccData.re * 100).toFixed(2)}%</p>
                      <p className="text-xs uppercase text-slate-500">Cost of Equity</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{(waccData.rd * 100).toFixed(2)}%</p>
                      <p className="text-xs uppercase text-slate-500">Cost of Debt</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{waccData.beta.toFixed(2)}</p>
                      <p className="text-xs uppercase text-slate-500">Beta</p>
                    </div>
                  </div>
                </Card>
                <Card title="Capital Structure">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={[
                        { name: 'Equity', value: waccData.equity },
                        { name: 'Debt', value: waccData.debt }
                      ]} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                        <Cell fill="#6366f1" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* FUND */}
            {activeModule === 'FUND' && fundamentals && (
              <Card title="Fundamentals">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatBox 
                    label="Market Cap" 
                    value={`$${(fundamentals.marketCapitalization || 0).toLocaleString()}`} 
                    icon={TrendingUp} 
                  />
                  <StatBox 
                    label="Total Debt" 
                    value={`$${(fundamentals.totalDebt || 0).toLocaleString()}`} 
                    icon={TrendingDown} 
                  />
                  <StatBox 
                    label="Beta" 
                    value={(fundamentals.beta || 0).toFixed(2)} 
                    icon={Activity} 
                  />
                </div>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Recent Income:</h4>
                    {fundamentals.incomeStatementHistory?.incomeStatementHistory?.slice(0,3).map((stmt, i) => (
                      <p key={i} className="text-slate-600">{stmt.endDate}: ${ (stmt.totalRevenue?.raw || 0).toLocaleString()}</p>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Balance Sheet:</h4>
                    {fundamentals.balanceSheetHistory?.balanceSheetStatements?.slice(0,3).map((stmt, i) => (
                      <p key={i} className="text-slate-600">{stmt.endDate}: Assets ${ (stmt.totalAssets?.raw || 0).toLocaleString()}</p>
                    ))}
                  </div>
                </div>
              </Card>
            )}
            {/* Markov */}
            {activeModule === 'G' && markov && (
              <Card title="Markov Chain Prediction">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8">
                  <div className="text-center">
                    <p className="text-4xl font-black">{(markov.probU * 100).toFixed(1)}%</p>
                    <p className="text-indigo-600 font-bold mt-1">Prob Up (from {markov.lastState})</p>
                  </div>
                  <div className="text-center">
                    <p className="text-4xl font-black text-rose-600">{(markov.probD * 100).toFixed(1)}%</p>
                    <p className="font-bold mt-1 text-rose-600">Prob Down</p>
                  </div>
                  <p className="col-span-full text-slate-600 mt-4">Based on EMA50/SMA200 state transitions over 1Y data.</p>
                </div>
              </Card>
            )}
            {/* Tail Risk */}
            {activeModule === 'A' && tailRisk && (
              <Card title="Tail Risk Metrics">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left p-3 font-semibold">Metric</th>
                        <th className="text-right p-3 font-semibold">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-3">Historical VaR (95%)</td>
                        <td className="p-3 text-right font-mono">{(tailRisk.varHist * 100).toFixed(2)}%</td>
                      </tr>
                      <tr>
                        <td className="p-3">CVaR (95%)</td>
                        <td className="p-3 text-right font-mono">{(tailRisk.cvarHist * 100).toFixed(2)}%</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-3 font-semibold">Hill Estimator α</td>
                        <td className="p-3 text-right font-mono">{tailRisk.hillAlpha.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {/* Option Pricing */}
            {activeModule === 'B' && (
              <Card title="Black-Scholes Option Pricing">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-4">Inputs</h4>
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-700">
                        Spot Price (S)
                        <input type="number" value={bsParams.S} onChange={(e) => setBsParams({...bsParams, S: parseFloat(e.target.value)})} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Strike (K)
                        <input type="number" value={bsParams.K} onChange={(e) => setBsParams({...bsParams, K: parseFloat(e.target.value)})} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Volatility (σ)
                        <input type="number" step="0.01" value={bsParams.sigma} onChange={(e) => setBsParams({...bsParams, sigma: parseFloat(e.target.value)})} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                      </label>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-blue-50 p-6 rounded-2xl">
                    <h4 className="font-semibold mb-4 text-emerald-800">Results</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-mono text-2xl text-emerald-700">${blackScholesCall(bsParams.S, bsParams.K, bsParams.T, bsParams.r, bsParams.sigma).price.toFixed(2)}</span> <span className="text-slate-600">(Call)</span></p>
                      <p>Time to Exp: <span className="font-mono">{(bsParams.T * 365).toFixed(0)} days</span></p>
                      <p>d1: <span className="font-mono">{blackScholesCall(bsParams.S, bsParams.K, bsParams.T, bsParams.r, bsParams.sigma).d1.toFixed(3)}</span></p>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

