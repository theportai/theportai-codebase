import asyncio
import logging
from src.server.start_live import run_live_simulation

# Optional: Customize logging level for production
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PortAI-Mainnet")

def main():
    logger.info("🚀 Starting PortAI in PRODUCTION MODE (Mainnet)...")

    try:
        # Set live trading flag globally
        import src.config.settings as settings # type: ignore
        settings.live_mode = True  # IMPORTANT: This enables real capital execution

        # Start the async live simulation loop (real trading mode)
        asyncio.run(run_live_simulation())

    except KeyboardInterrupt:
        logger.warning("🛑 Manual termination detected. Shutting down PortAI...")
    except Exception as e:
        logger.exception(f"❌ Unexpected exception in mainnet execution: {e}")

if __name__ == "__main__":
    main()