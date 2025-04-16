import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

let processRef: any = null;

export async function POST() {
  try {
    const statusData = JSON.parse(
      fs.readFileSync("logs/trading_status.json", "utf-8")
    );

    if (statusData.status !== "on") {
      console.log("🚫 Trading toggle is OFF. Not starting Python subprocess.");
      return NextResponse.json({ message: "Not started, toggle is off." });
    }

    const pythonPath = "/usr/local/bin/python3";
    const modulePath = "src.server.start_live";

    if (processRef) {
      console.log("⏸️ Trading already running. Skipping new start.");
      return NextResponse.json({ message: "Already running" });
    }

    processRef = exec(`${pythonPath} -m ${modulePath}`);

    processRef.stdout.on("data", (data) => {
      console.log("📥 Python Output:", data.toString());
    });

    processRef.stderr.on("data", (data) => {
      console.error("📤 Python STDERR:", data.toString());
    });

    processRef.on("exit", (code) => {
      console.log(`👋 Python process exited with code ${code}`);
      processRef = null;
    });

    return NextResponse.json({ message: "🚀 Trading started in background!" });
  } catch (err) {
    console.error("❌ Failed to start trading:", err);
    return NextResponse.json({ error: "Failed to start trading" }, { status: 500 });
  }
}