import { NextRequest, NextResponse } from "next/server";

interface Signal {
  sentiment: "BUY" | "SELL" | "HOLD" | "N/A";
  prediction: "BUY" | "SELL" | "HOLD" | "N/A";
  market: "BUY" | "SELL" | "HOLD" | "N/A";
  confidence: number;
}

// In-memory store for signal data (replace with a database in production)
let signalData: Signal = {
  sentiment: "BUY",
  prediction: "HOLD",
  market: "SELL",
  confidence: 75,
};

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

// Validate signal data against the Signal interface
const validateSignalData = (data: any): data is Signal => {
  const validSignals = ["BUY", "SELL", "HOLD", "N/A"];
  return (
    data &&
    typeof data === "object" &&
    validSignals.includes(data.sentiment) &&
    validSignals.includes(data.prediction) &&
    validSignals.includes(data.market) &&
    typeof data.confidence === "number" &&
    data.confidence >= 0 &&
    data.confidence <= 100
  );
};

// GET: Fetch the current signal data
export async function GET(req: NextRequest) {
  // Authenticate the request
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    if (!validateSignalData(signalData)) {
      logError("Invalid signal data format", signalData);
      return NextResponse.json({ error: "Invalid signal data format" }, { status: 500 });
    }

    return NextResponse.json(signalData);
  } catch (error) {
    logError("Failed to fetch signal data", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}