import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TRADE_LOG_FILE = path.resolve(process.cwd(), "logs/trade_log.csv");

export async function GET() {
  try {
    if (!fs.existsSync(TRADE_LOG_FILE)) {
      return NextResponse.json({ error: "Trade log not found." }, { status: 404 });
    }

    const raw = fs.readFileSync(TRADE_LOG_FILE, "utf-8").trim();
    const lines = raw.split("\n");

    if (lines.length <= 1) {
      return NextResponse.json([], { status: 200 }); // Only header exists
    }

    const headers = lines[0].split(",");
    const trades = lines.slice(1).map((line) => {
      const values = line.split(",");
      const entry: any = {};
      headers.forEach((header, idx) => {
        entry[header.trim()] = values[idx]?.trim();
      });
      return entry;
    });

    // Return only the latest 20 trades (reversed order)
    return NextResponse.json(trades.reverse().slice(0, 20));
  } catch (err) {
    console.error("❌ Failed to parse trade log:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}