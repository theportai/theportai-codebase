import { NextRequest, NextResponse } from "next/server";

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
    const metrics = {
      winRate: 68.5,
      totalTrades: 27,
      successfulTrades: 18,
      riskLevel: "medium",
    };
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Failed to fetch performance metrics:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}