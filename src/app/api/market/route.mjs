import { NextResponse } from "next/server";
import prisma from "../../lib/prisma.mjs";  // ✅ Use `.mjs`
import { getMarketData } from "../../utils/binance.mjs";  // ✅ Use `.mjs`

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol")?.toUpperCase() || "BTCUSDT";

    const marketData = await getMarketData(symbol);
    if (!marketData) throw new Error("Failed to fetch market data");

    // Store in database
    await prisma.cryptoPrice.create({
      data: {
        symbol,
        open: parseFloat(marketData.openPrice),
        high: parseFloat(marketData.highPrice),
        low: parseFloat(marketData.lowPrice),
      },
    });

    return NextResponse.json({ message: "Market data updated", marketData });
  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}