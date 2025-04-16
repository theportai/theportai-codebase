import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "logs", "signal_state.json");

export async function GET() {
  try {
    // ✅ Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Signal file not found" }, { status: 404 });
    }

    const data = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(data);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error reading signal_state.json:", error);
    return NextResponse.json({ error: "Failed to read signal data" }, { status: 500 });
  }
}