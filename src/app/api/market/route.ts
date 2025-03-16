import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMarketData } from "@/utils/binance";

export async function GET(req: Request) {
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
        close: parseFloat(marketData.lastPrice),
        volume: parseFloat(marketData.volume),
      },
    });

    return NextResponse.json({ message: "Market data updated", marketData });
  } catch (error) {
    console.error("❌ Error fetching market data:", error);
    return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
  }
}