import asyncio
import json
import websockets
from datetime import datetime, timedelta, timezone
import hvac
import os
import logging
import certifi
import aiofiles
from aiohttp import ClientSession
from src.utils.enhance_trade_logging import TradeLogger
from src.agents.portfolio_manager import PortfolioManager
from src.agents.trading_agents import MarketAnalysisAgent, SentimentAgent, PredictionAgent, DecisionMaker
from src.engine.portfolio_report import PortfolioReporter
from src.engine.asset_manager import Asset
from src.ml.feature_engineering import generate_features_labels
from src.core.vault import Vault
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from src.server.security import IPWhitelistMiddleware
from src.core.token_manager import TokenManager
from pydantic import BaseModel
from src.utils.audit_logger import log_event
from src.utils.binance_executor import get_binance_balances
import uvicorn
import signal
import sys
from pathlib import Path
from dotenv import load_dotenv
import threading
from typing import Dict, Any, List
import backoff
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
required_vars = ["VAULT_ADDR", "VAULT_TOKEN"]
for var in required_vars:
    if not os.getenv(var):
        logger.error(f"Missing required environment variable: {var}")
        sys.exit(1)

# Constants from environment variables
SIGNAL_STATE_FILE = os.getenv("SIGNAL_STATE_FILE", "logs/signal_state.json")
TRADING_STATUS_FILE = os.getenv("TRADING_STATUS_FILE", "logs/trading_status.json")
TRADE_LOG_FILE = os.getenv("TRADE_LOG_FILE", "logs/trade_log.json")
BINANCE_WS_URL = os.getenv("BINANCE_WS_URL", "wss://stream.binance.com:9443/stream?streams=btcusdt@kline_5m/ethusdt@kline_5m")
SNAPSHOT_INTERVAL = int(os.getenv("SNAPSHOT_INTERVAL", "300"))  # 5 minutes
MAX_WEBSOCKET_RETRIES = int(os.getenv("MAX_WEBSOCKET_RETRIES", "5"))
UPDATE_INTERVAL = 300  # Process updates every 5 minutes (in seconds)
REQUEST_RATE_LIMIT = 10  # Allow 10 requests per 2 seconds per endpoint per IP
RATE_LIMIT_WINDOW = 2  # Time window for rate limiting in seconds

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

# Create default signal_state.json if it doesn't exist
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

# Create default trade_log.json if it doesn't exist
if not Path(TRADE_LOG_FILE).exists():
    default_trades = []
    with open(TRADE_LOG_FILE, "w") as f:
        json.dump(default_trades, f)
    logger.info(f"Created default trade_log.json at {TRADE_LOG_FILE}")

# ----------------------------------
# FASTAPI SETUP
# ----------------------------------
app = FastAPI()
token_manager = TokenManager()

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add middleware for IP filtering
app.add_middleware(IPWhitelistMiddleware)

# Rate limiting storage
request_timestamps: Dict[str, List[float]] = defaultdict(list)

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    endpoint = request.url.path
    key = f"{client_ip}:{endpoint}"
    
    current_time = time()
    # Clean up old timestamps
    request_timestamps[key] = [t for t in request_timestamps[key] if current_time - t < RATE_LIMIT_WINDOW]
    
    # Check if request exceeds rate limit
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
    "BTCUSDT": 60000,
    "ETHUSDT": 3000,
    "SOLUSDT": 150,
}

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
            price = current_prices.get(symbol, 0)  # Use real-time price
            value = holdings * price
            pnl = getattr(asset, "get_pnL", lambda: 0)()
            trades = getattr(asset, "total_trades", 0)
            wins = getattr(asset, "winning_trades", 0)

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

        # Add USDT balance to total_balance
        usdt_balance = float(raw_balances.get("USDT", 0))
        total_balance += usdt_balance

        win_rate = (total_wins / total_trades * 100) if total_trades > 0 else 0
        # Calculate wl_today based on daily PnL (simplified as total_pnl for now)
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
        logger.error(f"Failed to read signal state: {str(e)}", exc_info=True)
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
        logger.error(f"Failed to read trading status: {str(e)}", exc_info=True)
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
        logger.error(f"Failed to update trading status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update trading status")

@app.post("/start-trading")
async def start_trading():
    try:
        logger.info("Start trading request received")
        return {"message": "Trading started"}
    except Exception as e:
        logger.error(f"Failed to start trading: {str(e)}", exc_info=True)
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
        logger.error(f"Failed to read trade log: {str(e)}", exc_info=True)
        return {"trades": [], "pagination": {"page": 1, "limit": limit, "total": 0, "totalPages": 1}}

class TokenRequest(BaseModel):
    agent_name: str

@app.post("/generate-token")
async def generate_token(request: TokenRequest):
    if not request.agent_name:
        logger.warning("Invalid agent_name in token request")
        raise HTTPException(status_code=400, detail="Agent name is required")

    try:
        result = token_manager.generate_token(request.agent_name)
        if isinstance(result, tuple) and len(result) >= 2:
            token, expires_at = result
        else:
            token = result
            expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        log_event("token_generated", f"Token generated for {request.agent_name}", agent=request.agent_name)
        logger.info(f"Token generated for {request.agent_name}, expires at {expires_at}")
        return {
            "token": token,
            "agent": request.agent_name,
            "expires_at": expires_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to generate token for {request.agent_name}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate token")

# ----------------------------------
# VAULT SETUP
# ----------------------------------
try:
    vault = Vault()
    BINANCE_API_KEY = vault.get_key("BINANCE_API_KEY", caller="start_live")
    if not BINANCE_API_KEY:
        BINANCE_API_KEY = os.getenv("BINANCE_API_KEY")
        if not BINANCE_API_KEY:
            logger.error("BINANCE_API_KEY not found in Vault or environment variables")
            sys.exit(1)
        logger.warning("BINANCE_API_KEY fetched from environment variable (not Vault)")

    BINANCE_SECRET = vault.get_key("BINANCE_SECRET", caller="start_live")
    if not BINANCE_SECRET:
        BINANCE_SECRET = os.getenv("BINANCE_SECRET")
        if not BINANCE_SECRET:
            logger.error("BINANCE_SECRET not found in Vault or environment variables")
            sys.exit(1)
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

asset_dict: Dict[str, Asset] = {}
raw_balances = get_binance_balances() if live_mode else {}

for symbol, base, quote in [("BTCUSDT", "BTC", "USDT"), ("ETHUSDT", "ETH", "USDT"), ("SOLUSDT", "SOL", "USDT")]:
    if live_mode:
        if raw_balances.get("USDT", 0) > 0 or raw_balances.get(base, 0) > 0:
            asset_dict[symbol] = Asset(symbol, base, quote, live_mode=live_mode)
    else:
        asset_dict[symbol] = Asset(symbol, base, quote, starting_balance=10000, live_mode=False)

for symbol, asset in asset_dict.items():
    asset.trade_count = 0
    asset.win_count = 0

asset_accuracy: Dict[str, Dict[str, int]] = {
    "btcusdt": {"correct_predictions": 0, "total_predictions": 0},
    "ethusdt": {"correct_predictions": 0, "total_predictions": 0},
}

class SafePortfolioReporter:
    def __init__(self, asset_dict: Dict[str, Asset], asset_accuracy: Dict[str, Dict[str, int]]):
        self.asset_dict = asset_dict
        self.asset_accuracy = asset_accuracy

    def generate_report(self):
        try:
            total_balance = 0
            total_pnl = 0
            total_trades = 0
            total_wins = 0

            for symbol, asset in self.asset_dict.items():
                value = asset.balance
                pnl = getattr(asset, "get_pnL", lambda: 0)()
                trades = getattr(asset, "total_trades", 0)
                wins = getattr(asset, "winning_trades", 0)

                accuracy = 0.0
                acc = self.asset_accuracy.get(symbol.lower(), {})
                if acc.get("total_predictions", 0) > 0:
                    accuracy = (acc["correct_predictions"] / acc["total_predictions"]) * 100

                logger.info(
                    f"[{symbol}] USD Value: ${value:.2f}, PnL: ${pnl:.2f}, "
                    f"Trades: {trades}, Wins: {wins}, Accuracy: {accuracy:.2f}%"
                )

                total_balance += value
                total_pnl += pnl
                total_trades += trades
                total_wins += wins

            logger.info(
                f"\nPortfolio Summary:\n"
                f"Total Balance: ${total_balance:.2f}\n"
                f"Total PnL: ${total_pnl:.2f}\n"
                f"Total Trades: {total_trades}\n"
                f"Total Wins: {total_wins}"
            )
        except Exception as e:
            logger.error(f"Error in generate_report: {str(e)}", exc_info=True)

portfolio_reporter = SafePortfolioReporter(asset_dict, asset_accuracy)

exposure = {
    "BTCUSDT": 0.001,
    "ETHUSDT": 0.01
}

trade_logger = TradeLogger()
decision_maker = DecisionMaker(quorum=1, trade_logger=trade_logger)

decision_maker.risk_manager.exposure_limits = {
    "BTCUSDT": {"capital": 50, "min_qty": 0.0005},
    "ETHUSDT": {"capital": 50, "min_qty": 0.005}
}

portfolio_manager = PortfolioManager(asset_dict, asset_accuracy, "logs/snapshots", live_mode=live_mode)
decision_maker.risk_manager.integrate_with_decision_maker(decision_maker)

# Last known signals to detect changes
last_signals = None

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
        logger.info(f"Updated signal state: {signal_data}")
    except Exception as e:
        logger.error(f"Failed to update signal state: {str(e)}", exc_info=True)

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
        trades.insert(0, trade_entry)  # Add new trade at the beginning
        async with aiofiles.open(path, "w") as f:
            await f.write(json.dumps(trades))
        logger.info(f"Updated trade log: {trade_entry}")
    except Exception as e:
        logger.error(f"Failed to update trade log: {str(e)}", exc_info=True)

def enrich_candle(kline: Dict[str, Any]) -> Dict[str, Any]:
    try:
        dt_obj = datetime.fromtimestamp(int(kline["t"]) / 1000, tz=timezone.utc)
        return {
            "timestamp": dt_obj,
            "timestamp_str": dt_obj.strftime("%Y-%m-%d %H:%M:%S"),
            "open": float(kline["o"]),
            "high": float(kline["h"]),
            "low": float(kline["l"]),
            "close": float(kline["c"]),
            "volume": float(kline["v"]),
        }
    except Exception as e:
        logger.error(f"Failed to enrich candle: {str(e)}", exc_info=True)
        raise

async def handle_kline_message(symbol: str, candle: Dict[str, Any]):
    global live_buffers, asset_accuracy, last_signals, current_prices

    if decision_maker.risk_manager.in_cooldown:
        logger.info(f"Cooldown active until {decision_maker.risk_manager.cooldown_end_time}. Holding.")
        return

    price = candle["close"]
    timestamp = candle.get("timestamp", datetime.now(timezone.utc))
    timestamp_str = candle.get("timestamp_str", timestamp.strftime("%Y-%m-%d %H:%M:%S"))

    # Update current price for the symbol
    symbol_upper = symbol.upper()
    current_prices[symbol_upper] = price

    live_buffers[symbol].append(candle)

    if len(live_buffers[symbol]) > 30:
        try:
            X_live, _ = generate_features_labels(live_buffers[symbol][-50:])
            last_features = X_live.iloc[-1:]
            predicted_label, confidence = prediction_agent.predict(last_features)
            prediction_signal = predicted_label
        except Exception as e:
            logger.error(f"[{symbol}] ML inference failed: {str(e)}", exc_info=True)
            prediction_signal = "hold"
            confidence = 0.0
    else:
        prediction_signal = "hold"
        confidence = 0.0

    market_signal = market_agent.analyze(candle)
    sentiment_signal = sentiment_agent.analyze(candle)

    signals = {
        "market_analysis": market_signal,
        "sentiment": sentiment_signal,
        "prediction": prediction_signal,
    }

    # Check if signals have changed
    signals_str = json.dumps(signals, sort_keys=True)
    if last_signals == signals_str:
        return  # No change, skip processing

    last_signals = signals_str

    await update_signal_state(
        sentiment=sentiment_signal,
        prediction=prediction_signal,
        market=market_signal,
        confidence=confidence
    )

    final_decision = decision_maker.decide(signals)

    logger.info(
        f"\n{timestamp_str} | [{symbol_upper}] PRICE: {price}\n"
        f"Signals: {signals} → Final Decision: {final_decision}\n"
        f"Model Confidence: {confidence:.2f}"
    )

    if confidence > 0.8:
        logger.info(f"HIGH CONFIDENCE SIGNAL: {prediction_signal} with {confidence:.2f}")

    actual_trend = 1 if market_signal == "buy" else -1 if market_signal == "sell" else 0
    predicted_trend = 1 if prediction_signal == "buy" else -1 if prediction_signal == "sell" else 0
    accuracy = 1 if actual_trend == predicted_trend else 0

    asset_accuracy[symbol]["correct_predictions"] += accuracy
    asset_accuracy[symbol]["total_predictions"] += 1
    accuracy_percentage = (
        (asset_accuracy[symbol]["correct_predictions"] / asset_accuracy[symbol]["total_predictions"]) * 100
        if asset_accuracy[symbol]["total_predictions"] > 0 else 0
    )
    logger.info(f"Accuracy for {symbol_upper}: {accuracy_percentage:.2f}%")

    asset = asset_dict[symbol_upper]
    last_price = getattr(asset, 'last_price', None)

    qty = 0.0
    if final_decision == "buy" and asset.holdings == 0:
        qty = portfolio_manager.calculate_quantity(symbol_upper, price)
        portfolio_manager.buy(symbol_upper, price, qty, live=live_mode)
        portfolio_manager.entry_price[symbol_upper] = price
        action = "BUY EXECUTED" if live_mode else "Would BUY"
        logger.info(f"{action} at ${price:.2f} | Qty: {qty:.6f} | Confidence: {confidence:.2f}")
        await update_trade_log(symbol_upper, "buy", price, qty, confidence)

    elif final_decision == "sell" and asset.holdings > 0:
        sl_tp_hit = portfolio_manager.check_sl_tp(symbol_upper, price)
        if sl_tp_hit:
            logger.warning(f"SL/TP Triggered for {symbol_upper} – {sl_tp_hit.upper()}")
            portfolio_manager.risk_manager.in_cooldown = True
            portfolio_manager.risk_manager.cooldown_end_time = datetime.now(timezone.utc) + timedelta(hours=2)

            async with aiofiles.open(portfolio_manager.sl_tp_log_path, "a") as f:
                await f.write(
                    f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')},"
                    f"{symbol_upper},{sl_tp_hit.upper()},"
                    f"{portfolio_manager.entry_price.get(symbol_upper)},{price},"
                    f"{round(price - portfolio_manager.entry_price.get(symbol_upper, 0), 4)}\n"
                )

        portfolio_manager.update_price(symbol_upper, price)
        qty = asset.holdings
        sell_success = portfolio_manager.sell(symbol_upper, price, qty, correct=(price > last_price), live=live_mode)
        if sell_success or not live_mode:
            action = "SELL EXECUTED" if live_mode else "Would SELL"
            logger.info(f"{action} at ${price:.2f} | Confidence: {confidence:.2f}")
            await update_trade_log(symbol_upper, "sell", price, qty, confidence)
    else:
        logger.info("PortAI is Holding Now - No action taken")

    asset.status()

    trade_count = getattr(asset, 'trade_count', 0)
    trade_logger.log_trade(
        symbol=symbol_upper,
        action=final_decision,
        price=price,
        confidence=confidence,
        correct=(actual_trend == predicted_trend),
        total_trades=trade_count,
        accuracy=accuracy_percentage,
    )

    if trade_count > 0 and trade_count % 5 == 0:
        snapshot_path = portfolio_manager.save_portfolio_snapshot()
        logger.info(f"Saved snapshot to: {snapshot_path}")

    portfolio_reporter.generate_report()

async def check_balance():
    if not live_mode:
        return True
    balances = get_binance_balances()
    usdt = float(balances.get("USDT", 0))
    if usdt == 0:
        logger.error("No tradeable balance in USDT. Please fund your Binance Spot Wallet.")
        async with ClientSession() as session:
            try:
                await session.post(
                    "http://localhost:3000/api/notify",
                    json={"message": "Insufficient USDT balance. Please fund your Binance Spot Wallet."}
                )
            except Exception as e:
                logger.error(f"Failed to notify frontend of balance issue: {str(e)}")
        return False
    return True

async def is_trading_on() -> bool:
    path = Path(TRADING_STATUS_FILE)
    if not path.exists():
        logger.warning(f"Trading status file {TRADING_STATUS_FILE} does not exist")
        return False
    try:
        async with aiofiles.open(path, "r") as f:
            data = json.loads(await f.read())
        return data.get("status") == "on"
    except Exception as e:
        logger.error(f"Failed to read trading status: {str(e)}", exc_info=True)
        return False

@backoff.on_exception(
    backoff.expo,
    (websockets.ConnectionClosedError, Exception),
    max_tries=MAX_WEBSOCKET_RETRIES,
    max_time=300
)
async def run_websocket():
    last_processed = {}
    async with websockets.connect(BINANCE_WS_URL) as websocket:
        logger.info("Connected to Binance WebSocket")
        async for message in websocket:
            if not await is_trading_on():
                logger.info("Trading stopped mid-stream. Breaking WebSocket loop.")
                break
            try:
                data = json.loads(message)
                if "stream" not in data or "data" not in data or "k" not in data["data"]:
                    logger.warning(f"Unexpected message format: {data}")
                    continue
                stream = data["stream"]
                kline = data["data"]["k"]
                if kline["x"]:  # Only process closed candles
                    symbol = stream.split("@")[0]
                    candle = enrich_candle(kline)
                    now = datetime.now(timezone.utc)
                    last_time = last_processed.get(symbol, now - timedelta(seconds=UPDATE_INTERVAL + 1))
                    if (now - last_time).total_seconds() >= UPDATE_INTERVAL:
                        await handle_kline_message(symbol, candle)
                        last_processed[symbol] = now
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}", exc_info=True)

async def snapshot_task():
    while await is_trading_on():
        try:
            snapshot_path = portfolio_manager.save_portfolio_snapshot()
            logger.info(f"Periodic snapshot saved to: {snapshot_path}")
        except Exception as e:
            logger.error(f"Failed to save periodic snapshot: {str(e)}", exc_info=True)
        await asyncio.sleep(SNAPSHOT_INTERVAL)

async def run_live_simulation():
    if not await check_balance():
        logger.error("Cannot proceed due to insufficient balance")
        return

    asyncio.create_task(snapshot_task())
    retry_count = 0

    while await is_trading_on():
        try:
            await run_websocket()
            retry_count = 0  # Reset retry count on successful connection
        except (websockets.ConnectionClosedError, Exception) as e:
            retry_count += 1
            if retry_count >= MAX_WEBSOCKET_RETRIES:
                logger.error(f"Max WebSocket retries ({MAX_WEBSOCKET_RETRIES}) reached. Shutting down.")
                break
            wait_time = min(2 ** retry_count, 60)  # Exponential backoff capped at 60 seconds
            logger.warning(f"WebSocket connection failed: {str(e)}. Retrying in {wait_time} seconds...")
            await asyncio.sleep(wait_time)
        if not await is_trading_on():
            logger.info("Trading turned off. Stopping live simulation.")
            break

def shutdown():
    logger.info("Shutting down PortAI server...")
    portfolio_reporter.generate_report()
    sys.exit(0)

def signal_handler(sig, frame):
    logger.info(f"Received signal {sig}. Initiating shutdown...")
    shutdown()

# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == "__main__":
    try:
        # Start the live simulation in a separate thread
        simulation_thread = threading.Thread(target=lambda: asyncio.run(run_live_simulation()))
        simulation_thread.start()

        # Start the FastAPI server
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received. Shutting down...")
        shutdown()
    except Exception as e:
        logger.error(f"Fatal error in main: {str(e)}", exc_info=True)
        shutdown()