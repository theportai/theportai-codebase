import sys
import os


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine.simulation_loop import run_live_simulation

if __name__ == "__main__":
    print("🚀 Starting Live Simulation with Binance WebSocket...")
    run_live_simulation()