import { format } from "date-fns";

interface Trade {
  timestamp: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: string;
  qty: string;
  confidence: number;
  mode: "LIVE" | "TEST";
}

interface PerformanceDataPoint {
  time: string;
  portfolio: number;
  btcValue: number;
  ethValue: number;
}

export const generateMockTrades = (count: number): Trade[] => {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - i * 15);

    const side = Math.random() > 0.5 ? "BUY" : "SELL";
    const symbol = Math.random() > 0.5 ? "BTCUSDT" : "ETHUSDT";
    const price = symbol === "BTCUSDT"
      ? (27000 + Math.random() * 1000).toFixed(2)
      : (1800 + Math.random() * 200).toFixed(2);

    return {
      timestamp: format(date, "HH:mm:ss"),
      symbol,
      side,
      price,
      qty: symbol === "BTCUSDT"
        ? (0.001 + Math.random() * 0.01).toFixed(4)
        : (0.01 + Math.random() * 0.2).toFixed(3),
      confidence: Math.floor(60 + Math.random() * 30),
      mode: "LIVE",
    };
  });
};

export const generateMockPerformanceData = (count: number): PerformanceDataPoint[] => {
  return Array.from({ length: count }, (_, i) => {
    const hour = new Date();
    hour.setHours(hour.getHours() - (count - 1 - i));
    return {
      time: `${hour.getHours().toString().padStart(2, "0")}:00`,
      portfolio: 10000 + Math.sin(i / 3) * 500 + i * 50,
      btcValue: 5000 + Math.cos(i / 4) * 300 + i * 30,
      ethValue: 3000 + Math.sin(i / 5) * 200 + i * 20,
    };
  });
};