"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  StopCircle, 
  LogOut, 
  TrendingUp, 
  RefreshCw,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  
  // State variables
  const [aiRunning, setAiRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("performance");
  const [signals, setSignals] = useState({
    sentiment: "HOLD",
    prediction: "HOLD",
    market: "HOLD",
    confidence: 0,
  });
  const [portfolio, setPortfolio] = useState({ BTC: 0, ETH: 0, USDT: 0 });
  const [tradeLog, setTradeLog] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [profitLoss, setProfitLoss] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0,
    total: 0
  });

  // Signal colors mapping
  const signalColors = {
    BUY: "text-green-600",
    SELL: "text-red-600",
    HOLD: "text-blue-600",
    "N/A": "text-gray-600"
  };

  // Initial data fetch
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        await Promise.all([
          fetchTradingStatus(),
          fetchSignals(),
          fetchPortfolio(),
          fetchTrades(),
          fetchPerformanceData()
        ]);
      } catch (error) {
        console.error("Error fetching initial data:", error);
        alert("Failed to load dashboard data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
    
    // Set up interval for periodic data refresh
    const interval = setInterval(() => {
      refreshData();
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Fetch trading status
  const fetchTradingStatus = async () => {
    try {
      const res = await fetch("/api/trading-toggle");
      const data = await res.json();
      setAiRunning(data.status === "on");
    } catch (err) {
      console.error("❌ Failed to fetch trading status:", err);
    }
  };

  // Fetch AI signals
  const fetchSignals = async () => {
    try {
      const res = await fetch("/api/ai-status");
      const data = await res.json();
      setSignals({
        sentiment: data.sentiment?.toUpperCase() || "N/A",
        prediction: data.prediction?.toUpperCase() || "N/A",
        market: data.market?.toUpperCase() || "N/A",
        confidence: data.confidence || 0,
      });
    } catch (err) {
      console.error("Error fetching signals:", err);
    }
  };

  // Fetch portfolio balances
  const fetchPortfolio = async () => {
    try {
      const res = await fetch("/api/portfolio-status");
      const data = await res.json();
      setPortfolio({ 
        BTC: data.BTC || 0, 
        ETH: data.ETH || 0, 
        USDT: data.USDT || 0 
      });
      
      // Calculate profit/loss (mock data for now)
      setProfitLoss({
        daily: (Math.random() * 5) - 2.5,
        weekly: (Math.random() * 15) - 5,
        monthly: (Math.random() * 25) - 8,
        total: (Math.random() * 40) - 10
      });
    } catch (err) {
      console.error("Error fetching portfolio:", err);
    }
  };

  // Fetch trade history
  const fetchTrades = async () => {
    try {
      const res = await fetch("/api/trade-log");
      const data = await res.json();
      setTradeLog(data);
    } catch (err) {
      console.error("Error fetching trade log:", err);
    }
  };

  // Fetch performance data (mock data for visualization)
  const fetchPerformanceData = async () => {
    try {
      // This would normally be fetched from an API endpoint
      // Generating mock data for demonstration
      const mockData = Array.from({ length: 24 }, (_, i) => {
        const hour = new Date();
        hour.setHours(hour.getHours() - (23 - i));
        return {
          time: `${hour.getHours().toString().padStart(2, '0')}:00`,
          portfolio: 10000 + (Math.sin(i / 3) * 500) + (i * 50),
          btcValue: 5000 + (Math.cos(i / 4) * 300) + (i * 30),
          ethValue: 3000 + (Math.sin(i / 5) * 200) + (i * 20)
        };
      });
      
      setPerformanceData(mockData);
    } catch (err) {
      console.error("Error fetching performance data:", err);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      await Promise.all([
        fetchTradingStatus(),
        fetchSignals(),
        fetchPortfolio(),
        fetchTrades()
      ]);
      
      console.log("Data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Toggle AI trading
  const toggleTrading = async () => {
    try {
      setIsLoading(true);
      const newStatus = aiRunning ? "off" : "on";

      // Step 1: Write to /api/trading-toggle
      const res = await fetch("/api/trading-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await res.json();
      console.log("🛰️ API Response:", result);

      // Step 2: Update button state
      setAiRunning(newStatus === "on");

      // Step 3: Trigger /api/start-trading if status is ON
      if (newStatus === "on") {
        await fetch("/api/start-trading", { method: "POST" });
        console.log("🚀 Trading launched from UI!");
        alert("AI Trading Activated");
      } else {
        alert("AI Trading Stopped");
      }
    } catch (err) {
      console.error("❌ Failed to toggle trading:", err);
      alert("Failed to toggle AI trading status");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/signup");
    } catch (err) {
      console.error("Error during logout:", err);
      alert("Logout Failed. Please try again.");
    }
  };

  // Calculate total portfolio value
  const totalPortfolioValue = Object.values(portfolio).reduce((sum, value) => sum + value, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-white dark:bg-slate-800 shadow-sm p-4 border-b">
        <div className="flex items-center">
          <TrendingUp className="h-6 w-6 text-blue-600 mr-2" />
          <h1 className="text-xl font-bold">PortAI Dashboard</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            size="sm" 
            variant="outline"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            size="sm"
            variant="secondary"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {/* Status Cards & Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Portfolio Summary Card */}
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Portfolio Value</p>
              <div className="flex flex-col">
                <span className="text-2xl font-bold">${totalPortfolioValue.toFixed(2)}</span>
                <div className="flex items-center mt-1">
                  {profitLoss.daily >= 0 ? (
                    <ChevronUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm ${profitLoss.daily >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {profitLoss.daily > 0 ? '+' : ''}{profitLoss.daily.toFixed(2)}% today
                  </span>
                </div>
              </div>
              
              {/* Trading Status */}
              <div className="mt-4">
                <span className={`text-sm px-2 py-1 rounded-full ${aiRunning ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                  {aiRunning ? "Trading Active" : "Trading Inactive"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Signal Cards */}
          {Object.entries(signals).map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  {label.replace(/^\w/, c => c.toUpperCase())}
                  {label === "confidence" && (
                    <span className="ml-1 text-gray-400 text-xs">(0-100)</span>
                  )}
                </p>
                <p className={`text-xl font-bold ${label !== "confidence" ? signalColors[value] : value >= 70 ? "text-green-600" : value >= 40 ? "text-blue-600" : "text-red-600"}`}>
                  {label === "confidence" ? `${value}%` : value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Portfolio Assets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(portfolio).map(([symbol, balance]) => (
            <Card key={symbol}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{symbol}</p>
                <div className="flex flex-col">
                  <p className="text-xl font-bold">${balance.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    {symbol === "BTC" ? "Bitcoin" : 
                     symbol === "ETH" ? "Ethereum" : "Tether"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Simple Tab System */}
        <div className="mb-6">
          <div className="border-b border-gray-200 mb-4">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab("performance")}
                className={`py-2 px-4 text-sm font-medium ${
                  activeTab === "performance"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Performance
              </button>
              <button
                onClick={() => setActiveTab("trades")}
                className={`py-2 px-4 text-sm font-medium ${
                  activeTab === "trades"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Trade Log
              </button>
            </div>
          </div>
          
          {activeTab === "performance" && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-4">Portfolio Performance</p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorBtc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorEth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="portfolio" 
                        name="Total Portfolio" 
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#colorPortfolio)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="btcValue" 
                        name="BTC Value" 
                        stroke="#f59e0b" 
                        fillOpacity={1} 
                        fill="url(#colorBtc)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="ethValue" 
                        name="ETH Value" 
                        stroke="#10b981" 
                        fillOpacity={1} 
                        fill="url(#colorEth)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
          
          {activeTab === "trades" && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-4">Real-Time Trade Log</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="p-2">Time</th>
                        <th className="p-2">Symbol</th>
                        <th className="p-2">Side</th>
                        <th className="p-2">Price</th>
                        <th className="p-2">Qty</th>
                        <th className="p-2">Conf</th>
                        <th className="p-2">Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradeLog.length > 0 ? (
                        tradeLog.map((trade, i) => (
                          <tr key={i} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-2">{trade.timestamp}</td>
                            <td className="p-2 font-medium">{trade.symbol}</td>
                            <td className={`p-2 ${trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                              {trade.side}
                            </td>
                            <td className="p-2">${parseFloat(trade.price).toFixed(2)}</td>
                            <td className="p-2">{trade.qty}</td>
                            <td className="p-2">{trade.confidence}</td>
                            <td className="p-2">
                              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100">
                                {trade.mode}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-gray-500">
                            No trades recorded yet. Start AI trading to begin.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
          
          <Button
            onClick={toggleTrading}
            disabled={isLoading}
            className={aiRunning ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : aiRunning ? (
              <StopCircle className="h-5 w-5 mr-2" />  
            ) : (
              <Play className="h-5 w-5 mr-2" />
            )}
            {aiRunning ? "Stop AI Trading" : "Start AI Trading"}
          </Button>
        </div>
      </main>
    </div>
  );
}