"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  Play,
  StopCircle,
  TrendingUp,
  TrendingDown,
  Loader,
  BarChart3,
  DollarSign,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [aiRunning, setAiRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const [signals, setSignals] = useState({
    sentiment: "HOLD",
    prediction: "BUY",
    market: "SELL",
    confidence: 0,
  });

  const [portfolio, setPortfolio] = useState({
    BTCUSDT: 0,
    ETHUSDT: 0,
    USDT: 0,
  });

  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [portfolioChangePercent, setPortfolioChangePercent] = useState(0);
  const [sentimentScore, setSentimentScore] = useState(0.12);
  const [tradeLog, setTradeLog] = useState([]);
  const [sentimentHistory, setSentimentHistory] = useState([
    { time: "00:00", value: 0.1 },
    { time: "01:00", value: 0.3 },
    { time: "02:00", value: 0.1 },
    { time: "03:00", value: 0.2 },
    { time: "04:00", value: 0.4 },
    { time: "05:00", value: 0.3 },
    { time: "06:00", value: 0.5 },
  ]);

  // Real-time polling from /api/ai-status
  useEffect(() => {
    const fetchSignals = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/ai-status");
        const data = await res.json();
        setSignals({
          sentiment: data.sentiment?.toUpperCase() || "N/A",
          prediction: data.prediction?.toUpperCase() || "N/A",
          market: data.market?.toUpperCase() || "N/A",
          confidence: data.confidence || 0,
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch AI signals:", err);
        setLoading(false);
      }
    };

    fetchSignals(); // initial call
    const interval = setInterval(fetchSignals, 5000); // every 5s

    return () => clearInterval(interval); // cleanup
  }, []);

  // Fetch portfolio data
  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const res = await fetch("/api/portfolio-status");
        const data = await res.json();
        
        // Update portfolio state
        const portfolioData = {
          BTCUSDT: data.BTC || 0,
          ETHUSDT: data.ETH || 0,
          USDT: data.USDT || 0,
        };
        
        setPortfolio(portfolioData);
        
        // Calculate total portfolio value
        const total = Object.values(portfolioData).reduce((sum, value) => sum + value, 0);
        setTotalPortfolioValue(total);
        
        // Simulate a portfolio change percent (replace with actual calculation if available)
        setPortfolioChangePercent(((Math.random() * 2) - 1) * 5); // Random value between -5% and +5%
      } catch (err) {
        console.error("Failed to fetch portfolio:", err);
      }
    };

    fetchPortfolio(); // initial load
    const interval = setInterval(fetchPortfolio, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, []);

  // Fetch trade log
  useEffect(() => {
    const fetchTradeLog = async () => {
      try {
        const res = await fetch("/api/trade-log");
        const data = await res.json();
        setTradeLog(data);
      } catch (err) {
        console.error("Failed to fetch trade log:", err);
      }
    };

    fetchTradeLog(); // initial
    const interval = setInterval(fetchTradeLog, 5000);
    return () => clearInterval(interval);
  }, []);

  // Get signal color
  const getSignalColor = (signal) => {
    if (signal === "BUY") return "text-green-500";
    if (signal === "SELL") return "text-red-500";
    return "text-blue-500"; // HOLD or other signals
  };

  // Toggle AI trading
  const toggleAiTrading = async () => {
    try {
      const newStatus = !aiRunning;
      setAiRunning(newStatus);
      
      // Optional: Call an API to actually start/stop trading
      await fetch("/api/toggle-trading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: newStatus }),
      });
    } catch (err) {
      console.error("Failed to toggle AI trading:", err);
      // Revert state if the API call fails
      setAiRunning(!newStatus);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              PortAI Trading Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              AI-powered trading signals and portfolio management
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <div className={`h-3 w-3 rounded-full mr-2 ${aiRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {aiRunning ? 'AI Trading Active' : 'AI Trading Inactive'}
              </span>
            </div>
            <Button 
              onClick={toggleAiTrading}
              className={aiRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}
            >
              {aiRunning ? (
                <>
                  <StopCircle className="mr-2 h-4 w-4" /> Stop AI
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" /> Start AI
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Portfolio Summary */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="col-span-1 md:col-span-2">
                <h2 className="text-xl font-bold mb-4">Portfolio Summary</h2>
                <div className="flex items-end">
                  <div className="text-3xl font-bold">${totalPortfolioValue.toFixed(2)}</div>
                  <div className={`ml-2 flex items-center ${portfolioChangePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {portfolioChangePercent >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                    {Math.abs(portfolioChangePercent).toFixed(2)}%
                  </div>
                </div>
              </div>
              
              {Object.entries(portfolio).map(([symbol, value]) => (
                <Card key={symbol} className="bg-white dark:bg-gray-800 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-500">{symbol}</p>
                        <p className="text-xl font-bold">${value.toFixed(2)}</p>
                      </div>
                      <div className={`text-xs ${symbol !== 'USDT' ? 'text-green-500' : 'text-blue-500'}`}>
                        {symbol !== 'USDT' ? (
                          <TrendingUp className="h-8 w-8 opacity-30" />
                        ) : (
                          <DollarSign className="h-8 w-8 opacity-30" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trading Signals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Sentiment Signal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <p className={`text-2xl font-bold ${getSignalColor(signals.sentiment)}`}>
                    {loading ? <Loader className="h-6 w-6 animate-spin" /> : signals.sentiment}
                  </p>
                  <div className="ml-auto">
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Confidence: {(signals.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Prediction Signal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <p className={`text-2xl font-bold ${getSignalColor(signals.prediction)}`}>
                    {loading ? <Loader className="h-6 w-6 animate-spin" /> : signals.prediction}
                  </p>
                  <div className="ml-auto">
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      AI Prediction
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Market Signal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <p className={`text-2xl font-bold ${getSignalColor(signals.market)}`}>
                    {loading ? <Loader className="h-6 w-6 animate-spin" /> : signals.market}
                  </p>
                  <div className="ml-auto">
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Market Trend
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">Sentiment Analysis</CardTitle>
                <BarChart3 className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart
                  data={sentimentHistory}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" />
                  <YAxis domain={[-1, 1]} />
                  <CartesianGrid strokeDasharray="3 3" />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8884d8" 
                    fillOpacity={1} 
                    fill="url(#colorSentiment)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">Trading Performance</CardTitle>
                <TrendingUp className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={[
                    { date: "Apr 1", value: 1000 },
                    { date: "Apr 2", value: 1200 },
                    { date: "Apr 3", value: 1100 },
                    { date: "Apr 4", value: 1300 },
                    { date: "Apr 5", value: 1500 },
                    { date: "Apr 6", value: 1400 },
                    { date: "Apr 7", value: 1800 },
                  ]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#6366f1"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                    name="Portfolio Value ($)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Trade Log */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">Recent Trades</CardTitle>
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Time</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3 rounded-r-lg">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeLog.length > 0 ? (
                    tradeLog.map((log, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                        <td className="px-4 py-3">{log.timestamp}</td>
                        <td className="px-4 py-3 font-medium">{log.symbol}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.action === 'BUY' ? 'bg-green-100 text-green-800' : 
                            log.action === 'SELL' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">${parseFloat(log.price).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: `${parseFloat(log.confidence) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 mt-1">
                            {(parseFloat(log.confidence) * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3">{parseFloat(log.accuracy).toFixed(1)}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                        No trade data available. Start AI trading to see results.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}