import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const filePath = path.resolve(process.cwd(), "logs/trading_status.json");

export async function GET() {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ status: "off" });
  }
}

export async function POST(request: Request) {
  try {
    const { status } = await request.json();
    fs.writeFileSync(filePath, JSON.stringify({ status }, null, 2));
    return NextResponse.json({ message: "Status updated" });
  } catch (error) {
    console.error("Failed to update trading status:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}