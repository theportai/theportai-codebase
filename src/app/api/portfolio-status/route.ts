import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PORTFOLIO_STATE_FILE = path.resolve(process.cwd(), "logs/portfolio_state.json");

export async function GET() {
  try {
    const data = fs.readFileSync(PORTFOLIO_STATE_FILE, "utf-8");
    const portfolio = JSON.parse(data);
    return NextResponse.json(portfolio);
  } catch (error) {
    console.error("❌ Failed to read portfolio state:", error);
    return NextResponse.json(
      { error: "Portfolio data not available." },
      { status: 500 }
    );
  }
}