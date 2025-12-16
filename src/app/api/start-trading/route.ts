import { NextRequest, NextResponse } from "next/server";

declare global {
  var tradingStatus: "on" | "off";
  var isTradingRunning: boolean;
}
global.tradingStatus = global.tradingStatus ?? "off";
global.isTradingRunning = global.isTradingRunning ?? false;

const authenticateRequest = (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader !== "Bearer mock-token") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
};

const logError = (message: string, error: unknown) => {
  console.error(`[${new Date().toISOString()}] ${message}:`, error);
};

const enqueueTradingJob = async () => {
  try {
    // Simulate starting the trading job
    global.isTradingRunning = true;
    console.log("📥 Enqueued trading job");

    setTimeout(() => {
      console.log("📈 Trading job completed");
      global.isTradingRunning = false;
    }, 60000); // Simulate 1 minute of trading
  } catch (error) {
    logError("Failed to enqueue trading job", error);
    global.isTradingRunning = false;
    throw new Error("Failed to start trading job");
  }
};

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    if (global.tradingStatus !== "on") {
      return NextResponse.json({ message: "Not started, toggle is off." }, { status: 400 });
    }

    if (global.isTradingRunning) {
      return NextResponse.json({ message: "Trading already running" }, { status: 409 });
    }

    await enqueueTradingJob();

    return NextResponse.json({ message: "Trading started successfully" });
  } catch (error) {
    logError("Failed to start trading", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}