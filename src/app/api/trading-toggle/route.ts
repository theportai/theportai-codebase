import { NextRequest, NextResponse } from "next/server";

let tradingStatus: "on" | "off" = "off";

const authenticateRequest = (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  // In production, validate the token (e.g., JWT) against your auth system
  if (!authHeader || authHeader !== "Bearer mock-token") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
};

const logError = (message: string, error: unknown) => {
  console.error(`[${new Date().toISOString()}] ${message}:`, error);
};

export async function GET(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    return NextResponse.json({ status: tradingStatus });
  } catch (error) {
    logError("Failed to fetch trading status", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { status } = body;

    if (!status || (status !== "on" && status !== "off")) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'on' or 'off'." },
        { status: 400 }
      );
    }

    tradingStatus = status;

    return NextResponse.json({ message: "Status updated successfully", status });
  } catch (error) {
    logError("Failed to update trading status", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}