import axios from "axios";
import WebSocket from "ws";

const BINANCE_BASE_URL = "https://api.binance.com/api/v3";
const SOCKET_URL = "wss://stream.binance.com:9443/ws";

// Fetch market data (latest price, 24hr change, volume)
export async function getMarketData(symbol: string) {
  try {
    const response = await axios.get(`${BINANCE_BASE_URL}/ticker/24hr`, {
      params: { symbol: symbol.toUpperCase() },
    });
    return response.data;
  } catch (error) {
    console.error("❌ Binance API Error:", error);
    return null;
  }
}
// WebSocket connection for real-time price updates
export function subscribeToMarket(symbol: string, onMessage: (data: object) => void) {
  const ws = new WebSocket(`${SOCKET_URL}/${symbol.toLowerCase()}@ticker`);

  ws.on("message", (data) => {
    const parsedData = JSON.parse(data.toString());
    onMessage(parsedData);
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket Error:", err);
  });

  return ws;
}