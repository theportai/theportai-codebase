import { NextRequest, NextResponse } from "next/server";

// Mock authentication function (replace with real authentication in production)
const authenticateRequest = (req: NextRequest) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== "Bearer mock-token") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
};

export async function GET(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    const performanceData = Array.from({ length: 24 }, (_, i) => {
      const hour = i.toString().padStart(2, "0");
      return {
        time: `${hour}:00`,
        portfolio: 5000 + Math.random() * 1000,
        btcValue: 3000 + Math.random() * 500,
        ethValue: 1500 + Math.random() * 300,
      };
    });
    return NextResponse.json(performanceData);
  } catch (error) {
    console.error("Failed to fetch performance data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}