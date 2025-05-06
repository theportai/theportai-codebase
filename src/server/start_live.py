import asyncio
import json
import websockets
from datetime import datetime, timedelta, timezone
import os
import logging
import certifi
import aiofiles
from aiohttp import ClientSession
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from src.utils.enhance_trade_logging import TradeLogger
from src.agents.portfolio_manager import PortfolioManager
from src.agents.trading_agents import MarketAnalysisAgent, SentimentAgent, PredictionAgent, DecisionMaker
from src.engine.asset_manager import Asset
from src.core.vault import Vault
from pydantic import BaseModel
from src.utils.binance_executor import get_binance_balances
import uvicorn
import signal
import sys
from pathlib import Path
from dotenv import load_dotenv
import threading
from typing import Dict, Any, List
from time import time
from collections import defaultdict

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/portai.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("PortAI")

# Reduce verbosity of uvicorn access logs
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# Validate required environment variables
required_vars = ["VAULT_ADDR", "VAULT_TOKEN", "BINANCE_API_KEY", "BINANCE_SECRET"]
for var in required_vars:
    if not os.getenv(var):
        logger.error(f"Missing required environment variable: {var}")
        sys.exit(1)

# Constants
SIGNAL_STATE_FILE = "logs/signal_state.json"
TRADING_STATUS_FILE = "logs/trading_status.json"
TRADE_LOG_FILE = "logs/trade_log.json"
BINANCE_WS_URL = "wss://stream.binance.com:9443/stream?streams=btcusdt@kline_5m/ethusdt@kline_5m"
SNAPSHOT_INTERVAL = 300  # 5 minutes
UPDATE_INTERVAL = 60  # Process updates every 1 minute
REQUEST_RATE_LIMIT = 10  # Allow 10 requests per 2 seconds per endpoint per IP
RATE_LIMIT_WINDOW = 2  # Time window for rate limiting in seconds
MAX_CONVERSION_PERCENTAGE = 0.5  # Cap conversion at 50% of BTC/ETH holdings
MIN_NOTIONAL_VALUE = 20.0  # Binance minimum notional value in USDT (approximate)
TRADING_FEE_RATE = 0.001  # Binance spot trading fee (0.1%)
NOTIFY_FRONTEND = os.getenv("NOTIFY_FRONTEND", "true").lower() == "true"

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

# Initialize state files if they don't exist
if not Path(SIGNAL_STATE_FILE).exists():
    default_signal = {
        "sentiment": "hold",
        "prediction": "hold",
        "market": "hold",
        "confidence": 0.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    with open(SIGNAL_STATE_FILE, "w") as f:
        json.dump(default_signal, f)
    logger.info(f"Created default signal_state.json at {SIGNAL_STATE_FILE}")

if not Path(TRADE_LOG_FILE).exists():
    default_trades = []
    with open(TRADE_LOG_FILE, "w") as f:
        json.dump(default_trades, f)
    logger.info(f"Created default trade_log.json at {TRADE_LOG_FILE}")

if not Path(TRADING_STATUS_FILE).exists():
    default_status = {"status": "on"}
    with open(TRADING_STATUS_FILE, "w") as f:
        json.dump(default_status, f)
    logger.info(f"Created default trading_status.json at {TRADING_STATUS_FILE} with status: on")

# ----------------------------------
# FASTAPI SETUP
# ----------------------------------
app = FastAPI()

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting storage
request_timestamps: Dict[str, List[float]] = defaultdict(list)

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    endpoint = request.url.path
    key = f"{client_ip}:{endpoint}"
    
    current_time = time()
    request_timestamps[key] = [t for t in request_timestamps[key] if current_time - t < RATE_LIMIT_WINDOW]
    
    if len(request_timestamps[key]) >= REQUEST_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests")
    
    request_timestamps[key].append(current_time)
    response = await call_next(request)
    return response

# ----------------------------------
# Live Mode Setup
# ----------------------------------
live_mode = os.getenv("LIVE_MODE", "true").lower() == "true"
os.environ['SSL_CERT_FILE'] = certifi.where()

# Global state for real-time prices
current_prices: Dict[str, float] = {
    "BTCUSDT": 94400.99,
    "ETHUSDT": 1817.99,
}

# Declare global variables at the module level before use
asset_dict: Dict[str, Asset] = {}
raw_balances = {}
portfolio_manager = None
usdt_balance = 0.0
asset_accuracy: Dict[str, Dict[str, int]] = {
    "btcusdt": {"correct_predictions": 0, "total_predictions": 0},
    "ethusdt": {"correct_predictions": 0, "total_predictions": 0},
}

# ----------------------------------
# VAULT SETUP
# ----------------------------------
try:
    vault = Vault()
    BINANCE_API_KEY = vault.get_key("BINANCE_API_KEY", caller="start_live")
    if not BINANCE_API_KEY:
        BINANCE_API_KEY = os.getenv("BINANCE_API_KEY")
        logger.warning("BINANCE_API_KEY fetched from environment variable (not Vault)")

    BINANCE_SECRET = vault.get_key("BINANCE_SECRET", caller="start_live")
    if not BINANCE_SECRET:
        BINANCE_SECRET = os.getenv("BINANCE_SECRET")
        logger.warning("BINANCE_SECRET fetched from environment variable (not Vault)")
except Exception as e:
    logger.error(f"Failed to initialize Vault or fetch keys: {str(e)}")
    raise RuntimeError("Vault initialization failed")

# ----------------------------------
# CONFIG
# ----------------------------------
live_buffers: Dict[str, list] = {
    "btcusdt": [],
    "ethusdt": [],
}

market_agent = MarketAnalysisAgent()
sentiment_agent = SentimentAgent()
prediction_agent = PredictionAgent()
trade_logger = TradeLogger()
decision_maker = DecisionMaker(quorum=1, trade_logger=trade_logger)

# Initialize assets
raw_balances = get_binance_balances() if live_mode else {}

for symbol, base, quote in [("BTCUSDT", "BTC", "USDT"), ("ETHUSDT", "ETH", "USDT")]:
    if live_mode:
        if raw_balances.get("USDT", 0) > 0 or raw_balances.get(base, 0) > 0:
            asset_dict[symbol] = Asset(symbol, base, quote, live_mode=live_mode)
    else:
        asset_dict[symbol] = Asset(symbol, base, quote, starting_balance=10000, live_mode=False)

for symbol, asset in asset_dict.items():
    asset.trade_count = 0
    asset.win_count = 0

# Adjust exposure limits based on available balance
portfolio_manager = PortfolioManager(asset_dict, asset_accuracy, "logs/snapshots", live_mode=live_mode)
usdt_balance = float(raw_balances.get("USDT", 0)) if live_mode else 10000
capital_per_asset = usdt_balance * 0.45  # Allocate 45% of USDT per asset
min_qty_per_asset = {
    "BTCUSDT": 0.0001,
    "ETHUSDT": 0.00005,
}

decision_maker.risk_manager.exposure_limits = {
    "BTCUSDT": {"capital": max(capital_per_asset, 0.1), "min_qty": min_qty_per_asset["BTCUSDT"]},
    "ETHUSDT": {"capital": max(capital_per_asset, 0.1), "min_qty": min_qty_per_asset["ETHUSDT"]}
}
decision_maker.risk_manager.integrate_with_decision_maker(decision_maker)

# Load historical data for PredictionAgent
for symbol in live_buffers.keys():
    prediction_agent.load_historical_data(symbol)

# Last known signals to detect changes
last_signals = None

# List to store async tasks
async_tasks = []

# ----------------------------------
# API ENDPOINTS
# ----------------------------------
@app.get("/health")
async def health_check():
    logger.info("Health check requested")
    return {"status": "ok"}

@app.get("/portfolio")
async def get_portfolio():
    try:
        total_balance = 0
        total_pnl = 0
        total_trades = 0
        total_wins = 0
        assets = []

        for symbol, asset in asset_dict.items():
            base = symbol.replace("USDT", "")
            holdings = asset.holdings
            price = current_prices.get(symbol, 0)
            value = holdings * price
            initial_value = getattr(asset, "initial_value", value)
            pnl = value - initial_value if initial_value else 0
            trades = getattr(asset, "trade_count", 0)
            wins = getattr(asset, "win_count", 0)

            accuracy = 0.0
            acc = asset_accuracy.get(symbol.lower(), {})
            if acc.get("total_predictions", 0) > 0:
                accuracy = (acc["correct_predictions"] / acc["total_predictions"]) * 100

            assets.append({
                "symbol": symbol,
                "value": value,
                "holdings": holdings,
                "pnl": pnl,
                "trades": trades,
                "wins": wins,
                "accuracy": accuracy
            })

            total_balance += value
            total_pnl += pnl
            total_trades += trades
            total_wins += wins

        usdt_balance_local = float(raw_balances.get("USDT", 0)) if live_mode else 10000
        total_balance += usdt_balance_local

        win_rate = (total_wins / total_trades * 100) if total_trades > 0 else 0
        wl_today = (total_pnl / total_balance * 100) if total_balance > 0 else 0

        portfolio_data = {
            "total_balance": total_balance,
            "total_pnl": total_pnl,
            "total_trades": total_trades,
            "total_wins": total_wins,
            "win_rate": win_rate,
            "wl_today": wl_today,
            "assets": assets
        }
        return portfolio_data
    except Exception as e:
        logger.error(f"Error fetching portfolio data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch portfolio data")

@app.get("/signals")
async def get_signals():
    try:
        path = Path(SIGNAL_STATE_FILE)
        if not path.exists():
            logger.warning(f"Signal state file {SIGNAL_STATE_FILE} does not exist")
            return {"sentiment": "hold", "prediction": "hold", "market": "hold", "confidence": 0.0}
        async with aiofiles.open(path, "r") as f:
            data = json.loads(await f.read())
        return data
    except Exception as e:
        logger.error(f"Failed to read signal state: {str(e)}")
        return {"sentiment": "hold", "prediction": "hold", "market": "hold", "confidence": 0.0}

@app.get("/trading-status")
async def get_trading_status():
    try:
        path = Path(TRADING_STATUS_FILE)
        if not path.exists():
            logger.warning(f"Trading status file {TRADING_STATUS_FILE} does not exist")
            return {"status": "off"}
        async with aiofiles.open(path, "r") as f:
            data = json.loads(await f.read())
        return {"status": data.get("status", "off")}
    except Exception as e:
        logger.error(f"Failed to read trading status: {str(e)}")
        return {"status": "off"}

class TradingStatusRequest(BaseModel):
    status: str

@app.post("/trading-toggle")
async def toggle_trading_status(request: TradingStatusRequest):
    try:
        if request.status not in ["on", "off"]:
            raise HTTPException(status_code=400, detail="Invalid status. Must be 'on' or 'off'.")
        async with aiofiles.open(TRADING_STATUS_FILE, "w") as f:
            await f.write(json.dumps({"status": request.status}))
        logger.info(f"Trading status updated to: {request.status}")
        return {"status": request.status}
    except Exception as e:
        logger.error(f"Failed to update trading status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update trading status")

@app.post("/start-trading")
async def start_trading():
    try:
        logger.info("Start trading request received")
        async with aiofiles.open(TRADING_STATUS_FILE, "w") as f:
            await f.write(json.dumps({"status": "on"}))
        return {"message": "Trading started"}
    except Exception as e:
        logger.error(f"Failed to start trading: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start trading")

class Trade(BaseModel):
    timestamp: str
    symbol: str
    side: str
    price: str
    qty: str
    confidence: float
    mode: str

@app.get("/trades")
async def get_trades(page: int = 1, limit: int = 20):
    try:
        path = Path(TRADE_LOG_FILE)
        if not path.exists():
            logger.warning(f"Trade log file {TRADE_LOG_FILE} does not exist")
            return {"trades": [], "pagination": {"page": 1, "limit": limit, "total": 0, "totalPages": 1}}

        async with aiofiles.open(path, "r") as f:
            trades = json.loads(await f.read())

        total = len(trades)
        total_pages = (total + limit - 1) // limit
        start = (page - 1) * limit
        end = start + limit
        paginated_trades = trades[start:end]

        return {
            "trades": paginated_trades,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": total_pages
            }
        }
    except Exception as e:
        logger.error(f"Failed to read trade log: {str(e)}")
        return {"trades": [], "pagination": {"page": 1, "limit": limit, "total": 0, "totalPages": 1}}

@app.get("/minimum-order-values")
async def get_minimum_order_values():
    try:
        min_order_values = {}
        for symbol in decision_maker.risk_manager.exposure_limits.keys():
            min_qty = decision_maker.risk_manager.exposure_limits[symbol]["min_qty"]
            price = current_prices.get(symbol, 0)
            min_value = min_qty * price
            min_order_values[symbol] = round(min_value, 2)
        return {"minimum_order_values": min_order_values}
    except Exception as e:
        logger.error(f"Failed to fetch minimum order values: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch minimum order values")

# ----------------------------------
# HELPER FUNCTIONS
# ----------------------------------

async def update_signal_state(sentiment: str, prediction: str, market: str, confidence: float):
    signal_data = {
        "sentiment": sentiment,
        "prediction": prediction,
        "market": market,
        "confidence": confidence,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    try:
        async with aiofiles.open(SIGNAL_STATE_FILE, "w") as f:
            await f.write(json.dumps(signal_data))
    except Exception as e:
        logger.error(f"Failed to update signal state: {str(e)}")

async def update_trade_log(symbol: str, action: str, price: float, qty: float, confidence: float):
    trade_entry = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "symbol": symbol,
        "side": action.upper(),
        "price": str(price),
        "qty": str(qty),
        "confidence": confidence,
        "mode": "LIVE" if live_mode else "TEST"
    }
    try:
        path = Path(TRADE_LOG_FILE)
        trades = []
        if path.exists():
            async with aiofiles.open(path, "r") as f:
                trades = json.loads(await f.read())
        trades.insert(0, trade_entry)
        async with aiofiles.open(path, "w") as f:
            await f.write(json.dumps(trades))
        logger.info(f"Trade executed: {trade_entry}")
    except Exception as e:
        logger.error(f"Failed to update trade log: {str(e)}")

def enrich_candle(kline: Dict[str, Any]) -> Dict[str, Any]:
    try:
        dt_obj = datetime.fromtimestamp(int(kline["t"]) / 1000, tz=timezone.utc)
        return {
            "timestamp": dt_obj.timestamp(),  # Unix epoch seconds
            "timestamp_str": dt_obj.strftime("%Y-%m-%d %H:%M:%S"),
            "open": float(kline["o"]),
            "high": float(kline["h"]),
            "low": float(kline["l"]),
            "close": float(kline["c"]),
            "volume": float(kline["v"]),
        }
    except (KeyError, ValueError) as e:
        logger.error(f"Invalid kline data: {str(e)}")
        raise

def validate_candle(candle: Dict[str, Any]) -> bool:
    """Validate that the candle dictionary has all required fields."""
    required_fields = {"timestamp", "open", "high", "low", "close", "volume"}
    return all(field in candle for field in required_fields)

async def handle_kline_message(symbol: str, candle: Dict[str, Any]):
    global live_buffers, asset_accuracy, last_signals, current_prices

    # Validate candle data
    if not validate_candle(candle):
        logger.warning(f"Skipping invalid candle for {symbol}: {candle}")
        return

    if decision_maker.risk_manager.in_cooldown:
        logger.info(f"Cooldown active until {decision_maker.risk_manager.cooldown_end_time}. Holding.")
        return

    price = candle["close"]
    timestamp_str = candle.get("timestamp_str", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))

    symbol_upper = symbol.upper()
    symbol_lower = symbol.lower()
    current_prices[symbol_upper] = price

    live_buffers[symbol_lower].append(candle)
    if len(live_buffers[symbol_lower]) > 100:
        live_buffers[symbol_lower] = live_buffers[symbol_lower][-50:]

    try:
        # Analyze the candle with each agent, passing the symbol
        market_signal, market_confidence = market_agent.analyze(candle, symbol_upper)
        sentiment_signal, sentiment_confidence = sentiment_agent.analyze(candle, symbol_upper)
        prediction_signal, prediction_confidence = prediction_agent.analyze(candle, symbol_upper)

        signals = {
            "market_analysis": (market_signal, market_confidence),
            "sentiment": (sentiment_signal, sentiment_confidence),
            "prediction": (prediction_signal, prediction_confidence),
        }

        signals_str = json.dumps({k: v[0] for k, v in signals.items()}, sort_keys=True)
        if last_signals == signals_str:
            return

        last_signals = signals_str

        final_decision, final_confidence = decision_maker.decide(signals, symbol=symbol_upper, current_price=price)

        await update_signal_state(
            sentiment=sentiment_signal,
            prediction=prediction_signal,
            market=market_signal,
            confidence=final_confidence
        )

        logger.info(
            f"\n{timestamp_str} | [{symbol_upper}] PRICE: {price}\n"
            f"Signals: {signals} | Decision: {final_decision} | Confidence: {final_confidence:.2f}"
        )

        if final_confidence > 0.8:
            logger.info(f"HIGH CONFIDENCE SIGNAL: {final_decision} with {final_confidence:.2f}")

        actual_trend = 1 if market_signal == "buy" else -1 if market_signal == "sell" else 0
        predicted_trend = 1 if prediction_signal == "buy" else -1 if prediction_signal == "sell" else 0
        accuracy = 1 if actual_trend == predicted_trend else 0

        asset_accuracy[symbol_lower]["correct_predictions"] += accuracy
        asset_accuracy[symbol_lower]["total_predictions"] += 1
        accuracy_percentage = (
            (asset_accuracy[symbol_lower]["correct_predictions"] / asset_accuracy[symbol_lower]["total_predictions"]) * 100
            if asset_accuracy[symbol_lower]["total_predictions"] > 0 else 0
        )

        asset = asset_dict[symbol_upper]
        qty = 0.0
        if final_decision == "buy" and (asset.holdings == 0 or not portfolio_manager.entry_price.get(symbol_upper)):
            qty = portfolio_manager.calculate_quantity(symbol_upper, price)
            min_qty = decision_maker.risk_manager.exposure_limits[symbol_upper]["min_qty"]
            logger.info(f"Calculated quantity for {symbol_upper}: {qty:.8f}, Minimum quantity: {min_qty:.8f}")
            if qty < min_qty:
                logger.warning(f"Calculated quantity {qty:.8f} for {symbol_upper} below minimum {min_qty:.8f}. Skipping trade.")
                return
            portfolio_manager.buy(symbol_upper, price, qty, live=live_mode)
            portfolio_manager.entry_price[symbol_upper] = price
            asset.initial_value = qty * price
            action = "BUY EXECUTED" if live_mode else "Would BUY"
            logger.info(f"{action} at ${price:.2f} | Qty: {qty:.6f} | Confidence: {final_confidence:.2f}")
            await update_trade_log(symbol_upper, "buy", price, qty, final_confidence)

        elif final_decision == "sell" and asset.holdings > 0:
            entry_price = portfolio_manager.entry_price.get(symbol_upper)
            if entry_price is None:
                logger.warning(f"No entry price found for {symbol_upper}. Cannot sell without a prior buy.")
                return

            sl_tp_hit = portfolio_manager.check_sl_tp(symbol_upper, price)
            if sl_tp_hit:
                logger.warning(f"SL/TP Triggered for {symbol_upper} – {sl_tp_hit.upper()}")
                portfolio_manager.risk_manager.in_cooldown = True
                portfolio_manager.risk_manager.cooldown_end_time = datetime.now(timezone.utc) + timedelta(hours=2)

                async with aiofiles.open(portfolio_manager.sl_tp_log_path, "a") as f:
                    await f.write(
                        f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')},"
                        f"{symbol_upper},{sl_tp_hit.upper()},"
                        f"{entry_price},{price},"
                        f"{round(price - entry_price, 4)}\n"
                    )

            qty = asset.holdings
            sell_success = portfolio_manager.sell(symbol_upper, price, qty, correct=(price > entry_price), live=live_mode)
            if sell_success or not live_mode:
                action = "SELL EXECUTED" if live_mode else "Would SELL"
                logger.info(f"{action} at ${price:.2f} | Confidence: {final_confidence:.2f}")
                await update_trade_log(symbol_upper, "sell", price, qty, final_confidence)
                asset.initial_value = 0
                portfolio_manager.entry_price[symbol_upper] = None  # Reset entry price after selling
        else:
            logger.info("Holding position")
    except Exception as e:
        logger.error(f"Error processing kline message for {symbol_upper}: {str(e)}", exc_info=True)

async def check_balance():
    global live_mode, raw_balances, asset_dict, portfolio_manager, usdt_balance
    if not live_mode:
        logger.info("Running in simulation mode with $10,000 virtual balance.")
        return True
    
    balances = get_binance_balances()
    raw_balances = balances  # Update global raw_balances
    usdt = float(balances.get("USDT", 0))
    btc = float(balances.get("BTC", 0))
    eth = float(balances.get("ETH", 0))
    
    # Calculate total portfolio value in USDT
    btc_value = btc * current_prices.get("BTCUSDT", 0)
    eth_value = eth * current_prices.get("ETHUSDT", 0)
    total_value = usdt + btc_value + eth_value
    
    # Dynamically calculate minimum USDT required based on current prices
    min_usdt_required = 0.0
    for symbol in decision_maker.risk_manager.exposure_limits.keys():
        min_qty = decision_maker.risk_manager.exposure_limits[symbol]["min_qty"]
        price = current_prices.get(symbol, 0)
        min_value = min_qty * price
        min_usdt_required = max(min_usdt_required, min_value)
    
    # Add a small buffer (e.g., 10%) to account for fees and price fluctuations
    min_usdt_required *= 1.1
    
    # Check if total portfolio value is sufficient
    if total_value < min_usdt_required:
        logger.warning(
            f"Total portfolio value {total_value:.2f} USDT (USDT: {usdt:.2f}, BTC: {btc_value:.2f}, ETH: {eth_value:.2f}) "
            f"is below the minimum required {min_usdt_required:.2f} for live trading. "
            f"Switching to simulation mode with $10,000 virtual balance."
        )
        live_mode = False
        # Update asset_dict for simulation mode
        asset_dict.clear()
        for symbol, base, quote in [("BTCUSDT", "BTC", "USDT"), ("ETHUSDT", "ETH", "USDT")]:
            asset_dict[symbol] = Asset(symbol, base, quote, starting_balance=10000, live_mode=False)
        for symbol, asset in asset_dict.items():
            asset.trade_count = 0
            asset.win_count = 0
        usdt_balance = 10000
        portfolio_manager = PortfolioManager(asset_dict, asset_accuracy, "logs/snapshots", live_mode=False)
        capital_per_asset = usdt_balance * 0.45
        decision_maker.risk_manager.exposure_limits = {
            "BTCUSDT": {"capital": max(capital_per_asset, 0.1), "min_qty": min_qty_per_asset["BTCUSDT"]},
            "ETHUSDT": {"capital": max(capital_per_asset, 0.1), "min_qty": min_qty_per_asset["ETHUSDT"]}
        }
        if NOTIFY_FRONTEND:
            async with ClientSession() as session:
                try:
                    await session.post(
                        "http://localhost:3000/api/notify",
                        json={"message": f"Total portfolio value {total_value:.2f} USDT is below the minimum required {min_usdt_required:.2f}. Switched to simulation mode with $10,000 virtual USDT."},
                        timeout=5
                    )
                except Exception as e:
                    logger.debug(f"Could not notify frontend of balance issue: {str(e)}. Continuing without notification.")
        return True
    
    # If USDT balance is insufficient but total value is enough, convert BTC/ETH to USDT
    if usdt < min_usdt_required:
        shortfall = min_usdt_required - usdt
        logger.info(
            f"USDT balance {usdt:.2f} is below minimum {min_usdt_required:.2f}, but total portfolio value is {total_value:.2f}. "
            f"Converting assets to meet shortfall of {shortfall:.2f} USDT."
        )
        
        # Adjust shortfall for fees (0.1% trading fee)
        shortfall_after_fees = shortfall / (1 - TRADING_FEE_RATE)
        
        # Try to cover shortfall by selling BTC first (since it has higher value)
        btc_to_sell = 0.0
        eth_to_sell = 0.0
        remaining_shortfall = shortfall_after_fees
        
        if btc_value > 0:
            max_btc_to_sell = btc * MAX_CONVERSION_PERCENTAGE
            # Calculate quantity needed to cover shortfall, considering minimum notional value
            btc_price = current_prices["BTCUSDT"]
            btc_needed = remaining_shortfall / btc_price
            # Adjust for minimum notional value
            min_notional_qty = MIN_NOTIONAL_VALUE / btc_price
            btc_to_sell = max(btc_needed, min_notional_qty)
            # Enforce the 50% cap
            btc_to_sell = min(btc_to_sell, max_btc_to_sell)
            if btc_to_sell * btc_price >= remaining_shortfall:
                # Adjust to exact amount needed, respecting minimum notional
                btc_to_sell = max(remaining_shortfall / btc_price, min_notional_qty)
                btc_to_sell = min(btc_to_sell, max_btc_to_sell)
                remaining_shortfall = 0
            else:
                remaining_shortfall -= btc_to_sell * btc_price
        
        # If shortfall remains, sell ETH
        if remaining_shortfall > 0 and eth_value > 0:
            max_eth_to_sell = eth * MAX_CONVERSION_PERCENTAGE
            eth_price = current_prices["ETHUSDT"]
            eth_needed = remaining_shortfall / eth_price
            min_notional_qty = MIN_NOTIONAL_VALUE / eth_price
            eth_to_sell = max(eth_needed, min_notional_qty)
            eth_to_sell = min(eth_to_sell, max_eth_to_sell)
            if eth_to_sell * eth_price >= remaining_shortfall:
                eth_to_sell = max(remaining_shortfall / eth_price, min_notional_qty)
                eth_to_sell = min(eth_to_sell, max_eth_to_sell)
                remaining_shortfall = 0
            else:
                remaining_shortfall -= eth_to_sell * eth_price
        
        # If shortfall still remains, switch to simulation mode
        if remaining_shortfall > 0:
            logger.warning(
                f"Insufficient BTC/ETH to cover shortfall of {remaining_shortfall:.2f} USDT after conversion attempts. "
                f"Switching to simulation mode with $10,000 virtual balance."
            )
            live_mode = False
            asset_dict.clear()
            for symbol, base, quote in [("BTCUSDT", "BTC", "USDT"), ("ETHUSDT", "ETH", "USDT")]:
                asset_dict[symbol] = Asset(symbol, base, quote, starting_balance=10000, live_mode=False)
            for symbol, asset in asset_dict.items():
                asset.trade_count = 0
                asset.win_count = 0
            usdt_balance = 10000
            portfolio_manager = PortfolioManager(asset_dict, asset_accuracy, "logs/snapshots", live_mode=False)
            capital_per_asset = usdt_balance * 0.45
            decision_maker.risk_manager.exposure_limits = {
                "BTCUSDT": {"capital": max(capital_per_asset, 0.1), "min_qty": min_qty_per_asset["BTCUSDT"]},
                "ETHUSDT": {"capital": max(capital_per_asset, 0.1), "min_qty": min_qty_per_asset["ETHUSDT"]}
            }
            if NOTIFY_FRONTEND:
                async with ClientSession() as session:
                    try:
                        await session.post(
                            "http://localhost:3000/api/notify",
                            json={"message": f"Insufficient BTC/ETH to cover shortfall of {remaining_shortfall:.2f} USDT. Switched to simulation mode with $10,000 virtual USDT."},
                            timeout=5
                        )
                    except Exception as e:
                        logger.debug(f"Could not notify frontend of balance issue: {str(e)}. Continuing without notification.")
            return True
        
        # Execute sales if needed
        if btc_to_sell > 0:
            btc_price = current_prices["BTCUSDT"]
            usdt_gained = btc_to_sell * btc_price * (1 - TRADING_FEE_RATE)
            portfolio_manager.sell("BTCUSDT", btc_price, btc_to_sell, live=True)
            logger.info(f"Sold {btc_to_sell:.8f} BTC at ${btc_price:.2f} to gain {usdt_gained:.2f} USDT after fees.")
            await update_trade_log("BTCUSDT", "sell", btc_price, btc_to_sell, 1.0)  # Confidence 1.0 for forced conversion
        
        if eth_to_sell > 0:
            eth_price = current_prices["ETHUSDT"]
            usdt_gained = eth_to_sell * eth_price * (1 - TRADING_FEE_RATE)
            portfolio_manager.sell("ETHUSDT", eth_price, eth_to_sell, live=True)
            logger.info(f"Sold {eth_to_sell:.8f} ETH at ${eth_price:.2f} to gain {usdt_gained:.2f} USDT after fees.")
            await update_trade_log("ETHUSDT", "sell", eth_price, eth_to_sell, 1.0)
        
        # Update balances after conversion
        raw_balances = get_binance_balances()
        usdt = float(raw_balances.get("USDT", 0))
        
        # Notify frontend of conversion
        if NOTIFY_FRONTEND:
            async with ClientSession() as session:
                try:
                    message = f"Converted {btc_to_sell:.8f} BTC and {eth_to_sell:.8f} ETH to meet minimum USDT requirement of {min_usdt_required:.2f}. New USDT balance: {usdt:.2f}."
                    await session.post(
                        "http://localhost:3000/api/notify",
                        json={"message": message},
                        timeout=5
                    )
                except Exception as e:
                    logger.debug(f"Could not notify frontend of conversion: {str(e)}. Continuing without notification.")
    
    # Recheck USDT balance after conversion
    if usdt < min_usdt_required:
        logger.warning(
            f"USDT balance {usdt:.2f} is still below the minimum required {min_usdt_required:.2f} after conversion. "
            f"Switching to simulation mode with $10,000 virtual balance."
        )
        live_mode = False
        # Update asset_dict for simulation mode
        asset_dict.clear()
        for symbol, base, quote in [("BTCUSDT", "BTC", "USDT"), ("ETHUSDT", "ETH", "USDT")]:
            asset_dict[symbol] = Asset(symbol, base, quote, starting_balance=10000, live_mode=False)
        for symbol, asset in asset_dict.items():
            asset.trade_count = 0
            asset.win_count = 0
        usdt_balance = 10000
        portfolio_manager = PortfolioManager(asset_dict, asset_accuracy, "logs/snapshots", live_mode=False)
        capital_per_asset = usdt_balance * 0.45
        decision_maker.risk_manager.exposure_limits = {
            "BTCUSDT": {"capital": max(capital_per_asset, 0.1), "min_qty": min_qty_per_asset["BTCUSDT"]},
            "ETHUSDT": {"capital": max(capital_per_asset, 0.1), "min_qty": min_qty_per_asset["ETHUSDT"]}
        }
        if NOTIFY_FRONTEND:
            async with ClientSession() as session:
                try:
                    await session.post(
                        "http://localhost:3000/api/notify",
                        json={"message": f"USDT balance {usdt:.2f} is below the minimum required {min_usdt_required:.2f} after conversion. Switched to simulation mode with $10,000 virtual USDT."},
                        timeout=5
                    )
                except Exception as e:
                    logger.debug(f"Could not notify frontend of balance issue: {str(e)}. Continuing without notification.")
        return True
    
    logger.info(f"USDT balance {usdt:.2f} is sufficient for live trading (minimum required: {min_usdt_required:.2f}).")
    return True

async def is_trading_on() -> bool:
    try:
        async with aiofiles.open(TRADING_STATUS_FILE, "r") as f:
            data = json.loads(await f.read())
        status = data.get("status", "off")
        logger.debug(f"Trading status checked: {status}")
        return status == "on"
    except Exception as e:
        logger.error(f"Failed to read trading status: {str(e)}")
        return False

async def run_websocket():
    retry_count = 0
    max_retries = 5
    while await is_trading_on():
        try:
            async with websockets.connect(BINANCE_WS_URL) as websocket:
                logger.info("Connected to Binance WebSocket")
                last_processed = {}
                async for message in websocket:
                    logger.debug(f"Received WebSocket message: {message}")
                    if not await is_trading_on():
                        logger.info("Trading stopped. Breaking WebSocket loop.")
                        break
                    try:
                        data = json.loads(message)
                        if "stream" not in data or "data" not in data or "k" not in data["data"]:
                            logger.debug("Skipping message: Missing stream, data, or kline info")
                            continue
                        stream = data["stream"]
                        kline = data["data"]["k"]
                        if kline["x"]:
                            symbol = stream.split("@")[0]
                            candle = enrich_candle(kline)
                            now = datetime.now(timezone.utc)
                            last_time = last_processed.get(symbol, now - timedelta(seconds=UPDATE_INTERVAL + 1))
                            time_since_last = (now - last_time).total_seconds()
                            logger.debug(f"Time since last processed for {symbol}: {time_since_last:.2f} seconds")
                            if time_since_last >= UPDATE_INTERVAL:
                                await handle_kline_message(symbol, candle)
                                last_processed[symbol] = now
                            else:
                                logger.debug(f"Skipping {symbol} kline: Too soon since last processed ({time_since_last:.2f} < {UPDATE_INTERVAL})")
                    except Exception as e:
                        logger.error(f"Error processing message: {str(e)}. Retrying message.", exc_info=True)
                        continue  # Retry the next message
            retry_count = 0
        except Exception as e:
            retry_count += 1
            if retry_count >= max_retries:
                logger.error(f"Max WebSocket retries ({max_retries}) reached. Shutting down.")
                break
            wait_time = min(2 ** retry_count, 60)
            logger.warning(f"WebSocket connection failed: {str(e)}. Retrying in {wait_time} seconds...")
            await asyncio.sleep(wait_time)

async def snapshot_task():
    while await is_trading_on():
        try:
            snapshot_path = portfolio_manager.save_portfolio_snapshot()
            if snapshot_path is None:
                logger.warning("Portfolio snapshot path is None. Check save_portfolio_snapshot implementation.")
            else:
                logger.info(f"Periodic snapshot saved to: {snapshot_path}")
        except Exception as e:
            logger.error(f"Failed to save periodic snapshot: {str(e)}")
        await asyncio.sleep(SNAPSHOT_INTERVAL)

async def run_live_simulation():
    if not await check_balance():
        logger.error("Cannot proceed due to balance check failure")
        return

    # Create and store tasks
    snapshot = asyncio.create_task(snapshot_task())
    websocket = asyncio.create_task(run_websocket())
    async_tasks.extend([snapshot, websocket])

    try:
        await asyncio.gather(snapshot, websocket)
    except asyncio.CancelledError:
        logger.info("Async tasks cancelled during shutdown. Exiting cleanly.")
    except Exception as e:
        logger.error(f"Error in run_live_simulation: {str(e)}")
        raise

# ----------------------------------
# SHUTDOWN HANDLING
# ----------------------------------
running = True
simulation_thread = None

def shutdown():
    global running, simulation_thread, async_tasks
    logger.info("Shutting down PortAI server...")
    running = False
    portfolio_manager.save_portfolio_snapshot()
    
    # Cancel async tasks
    for task in async_tasks:
        if not task.done():
            task.cancel()
    
    if simulation_thread:
        simulation_thread.join(timeout=5)
        if simulation_thread.is_alive():
            logger.warning("Simulation thread did not terminate within timeout.")
    sys.exit(0)

def signal_handler(sig, frame):
    logger.info(f"Received signal {sig}. Initiating shutdown...")
    shutdown()

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == "__main__":
    try:
        simulation_thread = threading.Thread(target=lambda: asyncio.run(run_live_simulation()))
        simulation_thread.start()
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received. Shutting down...")
        shutdown()
    except Exception as e:
        logger.error(f"Fatal error in main: {str(e)}")
        shutdown()