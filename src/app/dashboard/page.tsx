"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Play,
  StopCircle,
  LogOut,
  TrendingUp,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  InfoIcon,
  BarChart3,
  Clock,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useRouter } from "next/navigation";
import Progress from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Badge from "@/components/ui/badge";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import axios from "axios";
import axiosRetry from "axios-retry";

// Configure axios retry
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// Configure axios with default headers for authentication
axios.defaults.headers.common["Authorization"] = process.env.NEXT_PUBLIC_API_TOKEN || "Bearer mock-token";

// Environment variable for refresh interval
const REFRESH_INTERVAL = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || "60000", 10); // 60 seconds
const MIN_REQUEST_GAP = 1000; // Minimum 1 second between requests to avoid rate limiting
const REQUEST_DELAY = 200; // 200ms delay between sequential API calls

// TypeScript interfaces
interface Signal {
  sentiment: "BUY" | "SELL" | "HOLD" | "N/A";
  prediction: "BUY" | "SELL" | "HOLD" | "N/A";
  market: "BUY" | "SELL" | "HOLD" | "N/A";
  confidence: number;
}

interface Asset {
  symbol: string;
  value: number;
  holdings: number;
  pnl: number;
  trades: number;
  wins: number;
  accuracy: number;
}

interface Portfolio {
  total_balance: number;
  total_pnl: number;
  total_trades: number;
  total_wins: number;
  win_rate: number;
  wl_today: number;
  assets: Asset[];
}

interface ProfitLoss {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
}

interface Trade {
  timestamp: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: string;
  qty: string;
  confidence: number;
  mode: "LIVE" | "TEST";
}

interface TradeLogResponse {
  trades: Trade[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PerformanceDataPoint {
  time: string;
  portfolio: number;
  btcValue: number;
  ethValue: number;
}

interface Metrics {
  winRate: number;
  totalTrades: number;
  successfulTrades: number;
  riskLevel: "low" | "medium" | "high";
}

export default function DashboardPage() {
  const router = useRouter();

  // State variables
  const [aiRunning, setAiRunning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadingSignals, setLoadingSignals] = useState<boolean>(false);
  const [loadingPortfolio, setLoadingPortfolio] = useState<boolean>(false);
  const [loadingTrades, setLoadingTrades] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastRequestTime, setLastRequestTime] = useState<number>(0); // Track last request time
  const [rateLimitHit, setRateLimitHit] = useState<boolean>(false); // Track if rate limit was hit
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [signals, setSignals] = useState<Signal>({
    sentiment: "HOLD",
    prediction: "HOLD",
    market: "HOLD",
    confidence: 0,
  });
  const [finalDecision, setFinalDecision] = useState<"BUY" | "SELL" | "HOLD">("HOLD");
  const [portfolio, setPortfolio] = useState<Portfolio>({
    total_balance: 0,
    total_pnl: 0,
    total_trades: 0,
    total_wins: 0,
    win_rate: 0,
    wl_today: 0,
    assets: [],
  });
  const [tradeLog, setTradeLog] = useState<Trade[]>([]);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [performanceData, setPerformanceData] = useState<PerformanceDataPoint[]>([]);
  const [profitLoss, setProfitLoss] = useState<ProfitLoss>({ daily: 0, weekly: 0, monthly: 0, total: 0 });
  const [metrics, setMetrics] = useState<Metrics>({
    winRate: 0,
    totalTrades: 0,
    successfulTrades: 0,
    riskLevel: "medium",
  });

  // Signal colors mapping
  const signalColors: Record<string, string> = {
    BUY: "text-green-600",
    SELL: "text-red-600",
    HOLD: "text-blue-600",
    "N/A": "text-gray-600",
  };

  const signalBackgroundColors: Record<string, string> = {
    BUY: "bg-green-100 text-green-800 border-green-200",
    SELL: "bg-red-100 text-red-800 border-red-200",
    HOLD: "bg-blue-100 text-blue-800 border-blue-200",
    "N/A": "bg-gray-100 text-gray-800 border-gray-200",
  };

  // Ensure component is mounted on the client to avoid hydration issues
  useEffect(() => {
    setIsMounted(true);
    setLastUpdated(new Date());
  }, []);

  // Delay function to space out API calls
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Fetch functions with error handling
  const fetchTradingStatus = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:8000/trading-status");
      setAiRunning(res.data.status === "on");
    } catch (err: any) {
      const message = err.response?.data?.detail || "Failed to fetch trading status";
      if (err.response?.status === 429) setRateLimitHit(true);
      toast.error(message);
      console.error("Failed to fetch trading status:", err);
    }
  }, []);

  const fetchSignals = useCallback(async () => {
    try {
      setLoadingSignals(true);
      const res = await axios.get("http://localhost:8000/signals");
      const data = res.data;

      const updatedSignals: Signal = {
        sentiment: data.sentiment?.toUpperCase() || "N/A",
        prediction: data.prediction?.toUpperCase() || "N/A",
        market: data.market?.toUpperCase() || "N/A",
        confidence: data.confidence * 100 || 0, // Convert to percentage
      };
      setSignals(updatedSignals);

      const decisions = [updatedSignals.sentiment, updatedSignals.prediction, updatedSignals.market].filter(
        (d) => d !== "N/A" && d !== "HOLD"
      );

      if (decisions.length === 0) {
        setFinalDecision("HOLD");
      } else {
        const buyCount = decisions.filter((d) => d === "BUY").length;
        const sellCount = decisions.filter((d) => d === "SELL").length;

        if (buyCount > sellCount) {
          setFinalDecision("BUY");
        } else if (sellCount > buyCount) {
          setFinalDecision("SELL");
        } else {
          setFinalDecision("HOLD");
        }
      }
    } catch (err: any) {
      const message = err.response?.data?.detail || "Failed to fetch AI signals";
      if (err.response?.status === 429) setRateLimitHit(true);
      toast.error(message);
      console.error("Error fetching signals:", err);
      setSignals({
        sentiment: "N/A",
        prediction: "N/A",
        market: "N/A",
        confidence: 0,
      });
    } finally {
      setLoadingSignals(false);
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    try {
      setLoadingPortfolio(true);
      const res = await axios.get("http://localhost:8000/portfolio");
      const data = res.data;

      setPortfolio({
        total_balance: data.total_balance || 0,
        total_pnl: 0,
        total_trades: data.total_trades || 0,
        total_wins: data.total_wins || 0,
        win_rate: data.win_rate || 0,
        wl_today: data.wl_today || 0,
        assets: data.assets || [],
      });

      setProfitLoss({
        daily: data.wl_today || 0,
        weekly: 0,
        monthly: 0,
        total: data.total_pnl || 0,
      });
    } catch (err: any) {
      const message = err.response?.data?.detail || "Failed to fetch portfolio data";
      if (err.response?.status === 429) setRateLimitHit(true);
      toast.error(message);
      console.error("Error fetching portfolio:", err);
      setPortfolio({
        total_balance: 0,
        total_pnl: 0,
        total_trades: 0,
        total_wins: 0,
        win_rate: 0,
        wl_today: 0,
        assets: [],
      });
      setProfitLoss({ daily: 0, weekly: 0, monthly: 0, total: 0 });
    } finally {
      setLoadingPortfolio(false);
    }
  }, []);

  const fetchTrades = useCallback(async (page: number = 1, limit: number = 20) => {
    try {
      setLoadingTrades(true);
      const res = await axios.get(`http://localhost:8000/trades?page=${page}&limit=${limit}`);
      const data = res.data;
      setTradeLog(data.trades || []);
      setPagination({
        page: data.pagination.page || 1,
        limit: data.pagination.limit || 20,
        total: data.pagination.total || 0,
        totalPages: data.pagination.totalPages || 1,
      });
    } catch (err: any) {
      const message = err.response?.data?.detail || "Failed to fetch trade log";
      if (err.response?.status === 429) setRateLimitHit(true);
      toast.error(message);
      console.error("Error fetching trade log:", err);
      setTradeLog([]);
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 1 });
    } finally {
      setLoadingTrades(false);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      setMetrics({
        winRate: portfolio.win_rate,
        totalTrades: portfolio.total_trades,
        successfulTrades: portfolio.total_wins,
        riskLevel: "medium",
      });
    } catch (err: any) {
      const message = err.response?.data?.detail || "Failed to fetch performance metrics";
      if (err.response?.status === 429) setRateLimitHit(true);
      toast.error(message);
      console.error("Error fetching metrics:", err);
      setMetrics({
        winRate: 0,
        totalTrades: 0,
        successfulTrades: 0,
        riskLevel: "medium",
      });
    }
  }, [portfolio]);

  const fetchPerformanceData = useCallback(async () => {
    try {
      // Mock performance data
      const mockPerformance: PerformanceDataPoint[] = [
        { time: "01:00", portfolio: 0.95, btcValue: 0.5, ethValue: 0.3 },
        { time: "01:30", portfolio: 0.96, btcValue: 0.51, ethValue: 0.31 },
        { time: "02:00", portfolio: 0.95, btcValue: 0.5, ethValue: 0.3 },
      ];
      setPerformanceData(mockPerformance);
    } catch (err: any) {
      const message = err.response?.data?.detail || "Failed to fetch performance data";
      if (err.response?.status === 429) setRateLimitHit(true);
      toast.error(message);
      console.error("Error fetching performance data:", err);
      setPerformanceData([]);
    }
  }, []);

  // Initial data fetch and polling
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        await fetchTradingStatus();
        await delay(REQUEST_DELAY);
        await fetchSignals();
        await delay(REQUEST_DELAY);
        await fetchPortfolio();
        await delay(REQUEST_DELAY);
        await fetchTrades(1, 20);
        await delay(REQUEST_DELAY);
        await fetchPerformanceData();
        await delay(REQUEST_DELAY);
        await fetchMetrics();
        setLastUpdated(new Date());
        setLastRequestTime(Date.now());
        setRateLimitHit(false); // Reset rate limit flag on successful fetch
      } catch (error) {
        toast.error("Failed to load dashboard data");
        console.error("Error fetching initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();

    let intervalId: NodeJS.Timeout | null = null;

    if (aiRunning) {
      console.log(`[Polling Setup] Setting up polling interval every ${REFRESH_INTERVAL}ms at ${new Date().toISOString()}`);
      intervalId = setInterval(() => {
        if (rateLimitHit) {
          console.log(`[Polling Skipped] Rate limit hit, skipping polling at ${new Date().toISOString()}`);
          return;
        }
        console.log(`[Polling Trigger] Polling data at ${new Date().toISOString()}`);
        refreshData(false);
      }, REFRESH_INTERVAL);

      return () => {
        if (intervalId) {
          console.log(`[Polling Cleanup] Cleaning up polling interval at ${new Date().toISOString()}`);
          clearInterval(intervalId);
        }
      };
    }
  }, [aiRunning]);

  // Refresh all data with rate limiting protection
  const refreshData = useCallback(
    async (showRefreshing: boolean = true) => {
      const currentTime = Date.now();
      const timeSinceLastRequest = currentTime - lastRequestTime;

      if (timeSinceLastRequest < MIN_REQUEST_GAP) {
        console.log(`[Refresh Skipped] Too soon since last request (${timeSinceLastRequest}ms < ${MIN_REQUEST_GAP}ms)`);
        return;
      }

      if (isRefreshing) {
        console.log("[Refresh Skipped] Already refreshing");
        return;
      }

      try {
        if (showRefreshing) setIsRefreshing(true);
        console.log(`[Refresh Start] Refreshing data at ${new Date().toISOString()}`);
        setRateLimitHit(false); // Reset rate limit flag at the start
        await fetchTradingStatus();
        await delay(REQUEST_DELAY);
        await fetchSignals();
        await delay(REQUEST_DELAY);
        await fetchPortfolio();
        await delay(REQUEST_DELAY);
        await fetchTrades(pagination.page, pagination.limit);
        await delay(REQUEST_DELAY);
        await fetchMetrics();
        setLastUpdated(new Date());
        setLastRequestTime(Date.now());
        console.log("[Refresh Complete] Data refreshed successfully");
      } catch (error) {
        toast.error("Failed to refresh data");
        console.error("Error refreshing data:", error);
      } finally {
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    [fetchTradingStatus, fetchSignals, fetchPortfolio, fetchTrades, fetchMetrics, pagination.page, pagination.limit, lastRequestTime, isRefreshing]
  );

  // Toggle AI trading
  const toggleTrading = useCallback(async () => {
    try {
      setIsLoading(true);
      const newStatus = aiRunning ? "off" : "on";

      const res = await axios.post("http://localhost:8000/trading-toggle", { status: newStatus });
      setAiRunning(newStatus === "on");

      if (newStatus === "on") {
        await axios.post("http://localhost:8000/start-trading");
        toast.success("AI trading started");
      } else {
        toast.success("AI trading stopped");
      }
    } catch (err: any) {
      const message = err.response?.data?.detail || "Failed to toggle AI trading";
      if (err.response?.status === 429) setRateLimitHit(true);
      toast.error(message);
      console.error("Failed to toggle trading:", err);
    } finally {
      setIsLoading(false);
    }
  }, [aiRunning]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await axios.post("/api/auth/logout");
      router.push("/signup");
      toast.success("Logged out successfully");
    } catch (err: any) {
      const message = err.response?.data?.detail || "Logout failed";
      if (err.response?.status === 429) setRateLimitHit(true);
      toast.error(message);
      console.error("Error during logout:", err);
    }
  }, [router]);

  // Handle pagination navigation
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchTrades(newPage, pagination.limit);
  };

  // Format the last updated time
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return "";
    return format(lastUpdated, "HH:mm:ss");
  }, [lastUpdated]);

  // Determine risk level color
  const getRiskLevelColor = (level: string): string => {
    switch (level.toLowerCase()) {
      case "low":
        return "text-green-600";
      case "medium":
        return "text-yellow-600";
      case "high":
        return "text-red-600";
      default:
        return "text-blue-600";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between bg-white dark:bg-slate-800 shadow-sm p-4 border-b"
        role="banner"
      >
        <div className="flex items-center">
          <TrendingUp className="h-6 w-6 text-blue-600 mr-2" aria-hidden="true" />
          <h1 className="text-xl font-bold">PortAI Dashboard</h1>
          <Badge
            variant="outline"
            className={`ml-4 ${
              aiRunning
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-gray-100 text-gray-800 border-gray-200"
            }`}
            aria-label={aiRunning ? "AI Trading Active" : "Trading Inactive"}
          >
            {aiRunning ? "AI Trading Active" : "Trading Inactive"}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          {isMounted && lastUpdated && (
            <span className="text-xs text-gray-500 hidden md:inline-block">
              Last updated: {formattedLastUpdated}
            </span>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshData(true)}
            disabled={isRefreshing}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4 mr-1" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6" role="main">
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <Skeleton height={20} width={150} />
              </CardHeader>
              <CardContent>
                <Skeleton height={30} width="50%" />
                <Skeleton height={20} width="30%" className="mt-2" />
                <Skeleton height={80} className="mt-4" />
                <Skeleton height={40} className="mt-4" />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <Skeleton height={20} width={150} />
              </CardHeader>
              <CardContent>
                <Skeleton height={120} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Top Row - Summary and Signals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Portfolio Summary Card */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Wallet className="h-5 w-5 mr-2 text-blue-600" aria-hidden="true" />
                    Portfolio Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingPortfolio ? (
                    <div>
                      <Skeleton height={30} width="50%" />
                      <Skeleton height={20} width="30%" className="mt-2" />
                      <Skeleton height={80} className="mt-4" />
                      <Skeleton height={40} className="mt-4" />
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total Value</span>
                        <span className="text-2xl font-bold">
                          ${portfolio.total_balance.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center mt-1">
                        {portfolio.wl_today >= 0 ? (
                          <ChevronUp className="h-4 w-4 text-green-500" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-red-500" aria-hidden="true" />
                        )}
                        <span
                          className={`text-sm ${
                            portfolio.wl_today >= 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {portfolio.wl_today > 0 ? "+" : ""}
                          {portfolio.wl_today.toFixed(2)}% today
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="p-2 bg-gray-50 rounded-md dark:bg-slate-800">
                          <p className="text-xs text-gray-500">Win Rate</p>
                          <p className="text-lg font-medium">{portfolio.win_rate.toFixed(2)}%</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-md dark:bg-slate-800">
                          <p className="text-xs text-gray-500">Risk Level</p>
                          <p
                            className={`text-lg font-medium ${getRiskLevelColor(
                              metrics.riskLevel
                            )}`}
                          >
                            {metrics.riskLevel.charAt(0).toUpperCase() +
                              metrics.riskLevel.slice(1)}
                          </p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-md dark:bg-slate-800">
                          <p className="text-xs text-gray-500">Total Trades</p>
                          <p className="text-lg font-medium">{portfolio.total_trades}</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-md dark:bg-slate-800">
                          <p className="text-xs text-gray-500">Total PnL</p>
                          <p
                            className={`text-lg font-medium ${
                              portfolio.total_pnl >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {portfolio.total_pnl > 0 ? "+" : ""}
                            {portfolio.total_pnl.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Button
                          onClick={toggleTrading}
                          disabled={isLoading}
                          className={`w-full ${
                            aiRunning
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-green-600 hover:bg-green-700 text-white"
                          }`}
                          aria-label={
                            aiRunning ? "Stop AI Trading" : "Start AI Trading"
                          }
                        >
                          {isLoading ? (
                            <RefreshCw
                              className="h-4 w-4 mr-2 animate-spin"
                              aria-hidden="true"
                            />
                          ) : aiRunning ? (
                            <StopCircle
                              className="h-5 w-5 mr-2"
                              aria-hidden="true"
                            />
                          ) : (
                            <Play className="h-5 w-5 mr-2" aria-hidden="true" />
                          )}
                          {aiRunning ? "Stop AI Trading" : "Start AI Trading"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Signals Dashboard */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-blue-600" aria-hidden="true" />
                    Trading Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingSignals ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <Skeleton height={60} />
                      <Skeleton height={60} />
                      <Skeleton height={60} />
                      <Skeleton height={60} />
                      <Skeleton height={60} className="col-span-2 lg:col-span-4" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-lg border p-2">
                        <p className="text-xs text-gray-500">Market Analysis</p>
                        <p
                          className={`text-lg font-medium ${signalColors[signals.market]}`}
                        >
                          {signals.market}
                        </p>
                      </div>

                      <div className="rounded-lg border p-2">
                        <p className="text-xs text-gray-500">Sentiment</p>
                        <p
                          className={`text-lg font-medium ${signalColors[signals.sentiment]}`}
                        >
                          {signals.sentiment}
                        </p>
                      </div>

                      <div className="rounded-lg border p-2">
                        <p className="text-xs text-gray-500">Prediction</p>
                        <p
                          className={`text-lg font-medium ${signalColors[signals.prediction]}`}
                        >
                          {signals.prediction}
                        </p>
                      </div>

                      <div className="rounded-lg border p-2">
                        <p className="text-xs text-gray-500">Confidence</p>
                        <div className="mt-1">
                          <Progress
                            value={signals.confidence}
                            className="h-2"
                            aria-label={`Confidence: ${signals.confidence}%`}
                          />
                        </div>
                        <p className="text-sm mt-1">{signals.confidence.toFixed(0)}%</p>
                      </div>

                      <div
                        className={`col-span-2 lg:col-span-4 rounded-lg p-3 border-2 ${signalBackgroundColors[finalDecision]}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs font-medium">FINAL DECISION</p>
                            <p className="text-2xl font-bold">{finalDecision}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium">CONFIDENCE</p>
                            <p className="text-lg font-medium">{signals.confidence.toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Asset Allocation and Trade Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Asset Allocation */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <InfoIcon className="h-5 w-5 mr-2 text-blue-600" aria-hidden="true" />
                    Asset Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {portfolio.assets.length > 0 ? (
                      portfolio.assets.map((asset) => (
                        <div
                          key={asset.symbol}
                          className="flex justify-between items-center p-2 rounded-md border hover:bg-gray-50"
                        >
                          <div>
                            <p className="font-medium">{asset.symbol.split('USDT')[0]}</p>
                            <p className="text-xs text-gray-500">
                              {asset.holdings.toFixed(
                                asset.symbol.includes("BTC") ? 8 : asset.symbol.includes("ETH") ? 6 : 2
                              )}{" "}
                              {asset.symbol.split('USDT')[0]}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${asset.value.toFixed(2)}</p>
                            <p
                              className={`text-xs ${
                                asset.pnl >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {asset.pnl > 0 ? "+" : ""}
                              {asset.pnl.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-4">
                        No allocation data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Main Content Tabs */}
              <Card className="lg:col-span-2">
                <Tabs defaultValue="trades" className="w-full">
                  <CardHeader className="pb-0">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg flex items-center">
                        <Clock className="h-5 w-5 mr-2 text-blue-600" aria-hidden="true" />
                        Activity Monitor
                      </CardTitle>
                      <TabsList>
                        <TabsTrigger value="trades">Trades</TabsTrigger>
                        <TabsTrigger value="performance">Performance</TabsTrigger>
                      </TabsList>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4">
                    <TabsContent value="trades" className="mt-0">
                      {loadingTrades ? (
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
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b">
                                  <td className="p-2"><Skeleton height={20} width={50} /></td>
                                  <td className="p-2"><Skeleton height={20} width={60} /></td>
                                  <td className="p-2"><Skeleton height={20} width={40} /></td>
                                  <td className="p-2"><Skeleton height={20} width={60} /></td>
                                  <td className="p-2"><Skeleton height={20} width={50} /></td>
                                  <td className="p-2"><Skeleton height={20} width={80} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <>
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
                                </tr>
                              </thead>
                              <tbody>
                                {tradeLog.length > 0 ? (
                                  tradeLog.map((trade, i) => (
                                    <tr
                                      key={i}
                                      className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    >
                                      <td className="p-2">{trade.timestamp}</td>
                                      <td className="p-2 font-medium">{trade.symbol}</td>
                                      <td
                                        className={`p-2 ${
                                          trade.side === "BUY"
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }`}
                                      >
                                        {trade.side}
                                      </td>
                                      <td className="p-2">
                                        ${parseFloat(trade.price).toFixed(2)}
                                      </td>
                                      <td className="p-2">{trade.qty}</td>
                                      <td className="p-2">
                                        <div className="flex items-center">
                                          <Progress
                                            value={trade.confidence}
                                            className="h-1.5 w-12 mr-2"
                                            aria-label={`Confidence: ${trade.confidence}%`}
                                          />
                                          {trade.confidence}%
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td
                                      colSpan={6}
                                      className="p-4 text-center text-gray-500"
                                    >
                                      No trades recorded yet.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          {tradeLog.length > 0 && (
                            <div className="flex justify-between items-center mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                aria-label="Previous page"
                              >
                                <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                                Previous
                              </Button>
                              <span className="text-sm">
                                Page {pagination.page} of {pagination.totalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                aria-label="Next page"
                              >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="performance" className="mt-0">
                      {performanceData.length > 0 ? (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={performanceData} role="img" aria-label="Performance area chart">
                              <defs>
                                <linearGradient
                                  id="colorPortfolio"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#3b82f6"
                                    stopOpacity={0.8}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#3b82f6"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                                <linearGradient id="colorBtc" x1="0" y1="0" x2="0" y2="1">
                                  <stop
                                    offset="5%"
                                    stopColor="#f59e0b"
                                    stopOpacity={0.8}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#f59e0b"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                                <linearGradient
                                  id="colorEth"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#10b981"
                                    stopOpacity={0.8}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#10b981"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="time" />
                              <YAxis />
                              <CartesianGrid strokeDasharray="3 3" />
                              <Tooltip />
                              <Legend />
                              <Area
                                type="monotone"
                                dataKey="portfolio"
                                stroke="#3b82f6"
                                fillOpacity={1}
                                fill="url(#colorPortfolio)"
                              />
                              <Area
                                type="monotone"
                                dataKey="btcValue"
                                stroke="#f59e0b"
                                fillOpacity={1}
                                fill="url(#colorBtc)"
                              />
                              <Area
                                type="monotone"
                                dataKey="ethValue"
                                stroke="#10b981"
                                fillOpacity={1}
                                fill="url(#colorEth)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-500">
                          No performance data available
                        </div>
                      )}
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>
            </div>

            {/* Bottom Row - Settings and Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Settings Card */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Settings className="h-5 w-5 mr-2 text-blue-600" aria-hidden="true" />
                    Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Trading Mode</p>
                      <p className="text-lg font-medium">{aiRunning ? "Live Trading" : "Inactive"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Risk Tolerance</p>
                      <p className="text-lg font-medium">Medium</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">API Key Status</p>
                      <p className="text-lg font-medium text-green-600">Active</p>
                    </div>
                    <div>
                      <Button variant="outline" className="w-full">
                        <AlertCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                        View Alerts
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Alerts Card */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2 text-blue-600" aria-hidden="true" />
                    Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 border rounded-md">
                      <p className="text-sm text-gray-500">No new alerts</p>
                      <p className="text-lg font-medium">
                        Check back later for updates.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}