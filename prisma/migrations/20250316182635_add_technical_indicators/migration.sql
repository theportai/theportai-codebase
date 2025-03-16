-- CreateTable
CREATE TABLE "TechnicalIndicator" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sma_14" DOUBLE PRECISION,
    "ema_14" DOUBLE PRECISION,
    "rsi_14" DOUBLE PRECISION,
    "macd" DOUBLE PRECISION,
    "macd_signal" DOUBLE PRECISION,
    "macd_hist" DOUBLE PRECISION,
    "bb_high" DOUBLE PRECISION,
    "bb_mid" DOUBLE PRECISION,
    "bb_low" DOUBLE PRECISION,

    CONSTRAINT "TechnicalIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalIndicator_timestamp_key" ON "TechnicalIndicator"("timestamp");
