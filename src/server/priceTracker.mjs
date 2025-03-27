import { subscribeToMarket } from "../utils/binance.mjs"; // ✅ `.mjs`
import prisma from "../lib/prisma.mjs"; // ✅ `.mjs`

const trackPrice = async (symbol) => {
  subscribeToMarket(symbol, async (data) => {
    try {
      console.log(`📊 ${data.s} Price: ${data.c}`);

      await prisma.cryptoPrice.create({
        data: {
          symbol: data.s,
          open: parseFloat(data.o),
          high: parseFloat(data.h),
          low: parseFloat(data.l),
          close: parseFloat(data.c),
          volume: parseFloat(data.v), // ✅ FIXED: Added missing volume field
        },
      });

    } catch (error) {
      console.error("❌ Error processing price data:", error);
    }
  });
};

trackPrice("btcusdt");
trackPrice("ethusdt");