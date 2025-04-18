"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, StopCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {

  const [aiRunning, setAiRunning] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/trading-toggle");
        const data = await res.json();
        setAiRunning(data.status === "on");
      } catch (err) {
        console.error("❌ Failed to fetch trading status:", err);
      }
    };
    fetchStatus();
  }, []);


  const [signals, setSignals] = useState({
    sentiment: "HOLD",
    prediction: "HOLD",
    market: "HOLD",
    confidence: 0,
  });
  const [portfolio, setPortfolio] = useState({ BTC: 0, ETH: 0, USDT: 0 });
  const [tradeLog, setTradeLog] = useState([]);

  useEffect(() => {
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

    const fetchPortfolio = async () => {
      try {
        const res = await fetch("/api/portfolio-status");
        const data = await res.json();
        setPortfolio({ BTC: data.BTC || 0, ETH: data.ETH || 0, USDT: data.USDT || 0 });
      } catch (err) {
        console.error("Error fetching portfolio:", err);
      }
    };

    const fetchTrades = async () => {
      try {
        const res = await fetch("/api/trade-log");
        const data = await res.json();
        setTradeLog(data);
      } catch (err) {
        console.error("Error fetching trade log:", err);
      }
    };

    fetchSignals();
    fetchPortfolio();
    fetchTrades();
    const interval = setInterval(() => {
      fetchSignals();
      fetchPortfolio();
      fetchTrades();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold mb-6">PortAI Dashboard</h1>

      <section className="grid grid-cols-3 gap-4 mb-6">
        {Object.entries(signals).map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label.toUpperCase()}</p>
              <p className="text-xl font-bold text-blue-600">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-3 gap-4 mb-6">
        {Object.entries(portfolio).map(([symbol, balance]) => (
          <Card key={symbol}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{symbol}</p>
              <p className="text-xl font-bold">${balance.toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">Real-Time Trade Log</p>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th>Time</th>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Conf</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeLog.map((trade: any, i) => (
                    <tr key={i} className="border-t">
                      <td>{trade.timestamp}</td>
                      <td>{trade.symbol}</td>
                      <td>{trade.side}</td>
                      <td>${parseFloat(trade.price).toFixed(2)}</td>
                      <td>{trade.qty}</td>
                      <td>{trade.confidence}</td>
                      <td>{trade.mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="text-right">
        <Button
          onClick={async () => {
            try {
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
              }
            } catch (err) {
              console.error("❌ Failed to toggle trading:", err);
            }
          }}
        >
          {aiRunning ? (
            <>
              <StopCircle className="mr-2" /> Stop AI Trading
            </>
          ) : (
            <>
              <Play className="mr-2" /> Start AI Trading
            </>
          )}
        </Button>
      </div>
    </main>
  );
}