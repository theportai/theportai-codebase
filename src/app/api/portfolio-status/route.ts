import { NextRequest, NextResponse } from "next/server";


interface Asset {
  value: number;
  holdings: number;
  change24h: number;
}

interface Portfolio {
  BTC: Asset;
  ETH: Asset;
  USDT: Asset;
  BTC_holdings?: number; 
  ETH_holdings?: number; 
}

let portfolioData: Portfolio = {
  BTC: {
    value: 5420.58,
    holdings: 0.12,
    change24h: 2.4,
  },
  ETH: {
    value: 3250.75,
    holdings: 1.8,
    change24h: -1.2,
  },
  USDT: {
    value: 1000,
    holdings: 1000,
    change24h: 0,
  },
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

// Validate portfolio data against the Portfolio interface
const validatePortfolioData = (data: any): data is Portfolio => {
  return (
    data &&
    typeof data === "object" &&
    data.BTC &&
    typeof data.BTC.value === "number" &&
    typeof data.BTC.holdings === "number" &&
    typeof data.BTC.change24h === "number" &&
    data.ETH &&
    typeof data.ETH.value === "number" &&
    typeof data.ETH.holdings === "number" &&
    typeof data.ETH.change24h === "number" &&
    data.USDT &&
    typeof data.USDT.value === "number" &&
    typeof data.USDT.holdings === "number" &&
    typeof data.USDT.change24h === "number"
  );
};

// GET: Fetch the current portfolio data
export async function GET(req: NextRequest) {
  // Authenticate the request
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    
    if (!validatePortfolioData(portfolioData)) {
      logError("Invalid portfolio data format", portfolioData);
      return NextResponse.json({ error: "Invalid portfolio data format" }, { status: 500 });
    }

    // Format the response to match the expected API structure
    const response = {
      BTC: portfolioData.BTC.value,
      ETH: portfolioData.ETH.value,
      USDT: portfolioData.USDT.value,
      BTC_holdings: portfolioData.BTC.holdings,
      ETH_holdings: portfolioData.ETH.holdings,
    };

    return NextResponse.json(response);
  } catch (error) {
    logError("Failed to fetch portfolio data", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}