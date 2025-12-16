import { NextRequest, NextResponse } from "next/server";
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

let tradeData: Trade[] = Array.from({ length: 50 }, (_, i) => {
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

// Simulated authentication middleware (replace with real auth in production)
const authenticateRequest = (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  // In production, validate the token (e.g., JWT) against your auth system
  if (!authHeader || authHeader !== "Bearer mock-token") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
};

// Simulated logging function (replace with a real logging service in production, e.g., Winston or Sentry)
const logError = (message: string, error: unknown) => {
  console.error(`[${new Date().toISOString()}] ${message}:`, error);
};

// Validate trade data against the Trade interface
const validateTradeData = (data: any): data is Trade => {
  const validSides = ["BUY", "SELL"];
  const validModes = ["LIVE", "TEST"];
  return (
    data &&
    typeof data === "object" &&
    typeof data.timestamp === "string" &&
    typeof data.symbol === "string" &&
    validSides.includes(data.side) &&
    typeof data.price === "string" &&
    !isNaN(parseFloat(data.price)) &&
    typeof data.qty === "string" &&
    !isNaN(parseFloat(data.qty)) &&
    typeof data.confidence === "number" &&
    data.confidence >= 0 &&
    data.confidence <= 100 &&
    validModes.includes(data.mode)
  );
};

// GET: Fetch the trade log with pagination
export async function GET(req: NextRequest) {
  // Authenticate the request
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    // Extract pagination parameters from query string
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100." },
        { status: 400 }
      );
    }

    // In a real app, fetch from a database with pagination (e.g., Prisma, MongoDB)
    // Example with Prisma:
    // const trades = await prisma.trade.findMany({
    //   skip: (page - 1) * limit,
    //   take: limit,
    //   orderBy: { timestamp: "desc" },
    // });
    // const total = await prisma.trade.count();

    // Simulate pagination with in-memory data
    const total = tradeData.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const trades = tradeData.slice(start, end);

    // Validate each trade
    const invalidTrade = trades.find((trade) => !validateTradeData(trade));
    if (invalidTrade) {
      logError("Invalid trade data format", invalidTrade);
      return NextResponse.json({ error: "Invalid trade data format" }, { status: 500 });
    }

    // Return paginated response
    return NextResponse.json({
      trades,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logError("Failed to fetch trade log", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}