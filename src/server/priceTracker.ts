import { subscribeToMarket } from "@/utils/binance";
import prisma from "@/lib/prisma";


type BinanceTicker = {
    e: string; // Event type
    s: string; // Symbol
    o: string; // Open price
    h: string; // High price
    l: string; // Low price
    c: string; // Close price
    v: string; // Volume
};

// 🔹 Explicitly cast WebSocket data as BinanceTicker
const trackPrice = async (symbol: string) => {
    subscribeToMarket(symbol, async (data: unknown) => {
        try {
            const ticker = data as BinanceTicker;  // ✅ Explicitly cast

            if (!ticker.c || !ticker.o || !ticker.h || !ticker.l || !ticker.v) {
                console.error(`❌ Invalid data received from Binance WebSocket:`, ticker);
                return;
            }

            console.log(`📊 ${ticker.s} Price: ${ticker.c}`);

            // Store in DB (Ensure Prisma model matches)
            await prisma.cryptoPrice.create({
                data: {
                    symbol: ticker.s,
                    open: parseFloat(ticker.o),
                    high: parseFloat(ticker.h),
                    low: parseFloat(ticker.l),
                    close: parseFloat(ticker.c),
                    volume: parseFloat(ticker.v),
                },
            });

        } catch (error) {
            console.error("❌ Error processing price data:", error);
        }
    });
};


trackPrice("btcusdt");
trackPrice("ethusdt");