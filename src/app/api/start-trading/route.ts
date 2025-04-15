import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

let processRef: any = null;

export async function POST() {
  try {
    // Use absolute Python path to avoid module resolution issues
    const pythonPath = "/usr/local/bin/python3";
    const modulePath = "src.server.start_live"; // Module notation, NOT file path

    // If already running, don't start again
    if (processRef) {
      console.log("⏸️ Trading already running. Skipping new start.");
      return NextResponse.json({ message: "Already running" });
    }

    // Launch trading script as a module
    processRef = exec(`${pythonPath} -m ${modulePath}`);

    processRef.stdout.on("data", (data) => {
      console.log("📥 Python Output:", data.toString());
    });

    processRef.stderr.on("data", (data) => {
      console.error("❌ Python Error:", data.toString());
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