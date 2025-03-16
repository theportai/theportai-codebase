/*
  Warnings:

  - You are about to drop the `TechnicalIndicator` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "TechnicalIndicator";

-- CreateTable
CREATE TABLE "TechnicalIndicators" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sma_14" DOUBLE PRECISION NOT NULL,
    "ema_14" DOUBLE PRECISION NOT NULL,
    "rsi_14" DOUBLE PRECISION NOT NULL,
    "macd" DOUBLE PRECISION NOT NULL,
    "macd_signal" DOUBLE PRECISION NOT NULL,
    "macd_hist" DOUBLE PRECISION NOT NULL,
    "bb_high" DOUBLE PRECISION NOT NULL,
    "bb_mid" DOUBLE PRECISION NOT NULL,
    "bb_low" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TechnicalIndicators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalIndicators_timestamp_key" ON "TechnicalIndicators"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalIndicators_symbol_timestamp_key" ON "TechnicalIndicators"("symbol", "timestamp");
