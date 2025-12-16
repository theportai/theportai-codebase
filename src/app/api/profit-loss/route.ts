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
    const profitLoss = {
      daily: 2.5,
      weekly: 7.5,
      monthly: 15,
      total: 30,
    };
    return NextResponse.json(profitLoss);
  } catch (error) {
    console.error("Failed to fetch profit/loss data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}