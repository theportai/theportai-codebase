import logging
import pandas as pd # type: ignore
import numpy as np # type: ignore
from datetime import datetime, timedelta


# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('PortAI-RiskManager')

class RiskManager:
    def __init__(self, exposure_limits=None):
        """
        Initialize the risk manager with exposure limits per symbol.
        
        Args:
            exposure_limits (dict): Dictionary mapping symbols to their configuration.
                                   Format: {"BTCUSDT": {"capital": 50, "min_qty": 0.0005}, ...}
        """
        
        if exposure_limits is None:
            self.exposure_limits = {
                "BTCUSDT": {"capital": 50, "min_qty": 0.0005},
                "ETHUSDT": {"capital": 50, "min_qty": 0.005}
            }
        else:
            self.exposure_limits = exposure_limits


        self.current_exposures = {}
        self.trade_history = []
        self.max_daily_loss = 0.02  # 2% portfolio value limit for daily losses
        self.last_reset = datetime.now()
        self.daily_pnl = 0.0
        self.drawdown_threshold = 0.05  # 5% max drawdown before pausing trading
        self.in_cooldown = False
        self.cooldown_end_time = None
        self.cooldown_duration = timedelta(hours=2)
        
        logger.info(f"RiskManager initialized with exposure limits: {self.exposure_limits}")
    
    def is_within_limit(self, symbol, trade_amount, portfolio_value=None):
        """
        Check if placing a trade stays within the exposure limit for the symbol.
        
        Args:
            symbol (str): The trading pair symbol
            trade_amount (float): The size of the intended trade in quote currency
            portfolio_value (float, optional): Current portfolio value, used to calculate relative exposure
            
        Returns:
            bool: True if the trade is within limits, False otherwise
        """
        # Check if we're in cooldown period
        if self.in_cooldown:
            if datetime.now() > self.cooldown_end_time:
                logger.info("Cooldown period ended, resuming trading")
                self.in_cooldown = False
            else:
                logger.warning(f"Trading paused due to risk limits: Cooldown until {self.cooldown_end_time}")
                return False
        
        # If no limit is set for this symbol, use a conservative default
        if symbol not in self.exposure_limits:
            default_config = {"capital": 5, "min_qty": 0.001}  # Default conservative config
            logger.warning(f"No exposure limit set for {symbol}, using default {default_config}")
            self.exposure_limits[symbol] = default_config
        
        symbol_config = self.exposure_limits[symbol]
        
        # Get capital allocation limit from config
        capital_limit = symbol_config.get("capital", 50)  # Default to 50 if not specified
        
        # Check minimum trade quantity
        min_qty = symbol_config.get("min_qty", 0.001)  # Default min quantity
        if trade_amount < min_qty:
            logger.warning(f"Trade rejected: {symbol} quantity {trade_amount} below minimum {min_qty}")
            return False
                
        # Current exposure for this symbol
        current = self.current_exposures.get(symbol, 0.0)
        
        # Calculate new total exposure if this trade is placed
        new_exposure = current + trade_amount
        
        # If portfolio value is provided, check against percentage limit
        if portfolio_value:
            # Convert capital limit from fixed amount to percentage of portfolio
            capital_limit_pct = capital_limit / portfolio_value
            exposure_ratio = new_exposure / portfolio_value
            
            if exposure_ratio > capital_limit_pct:
                logger.warning(f"Trade rejected: {symbol} exposure would be {exposure_ratio:.4f}, exceeding limit {capital_limit_pct:.4f}")
                return False
        # Otherwise check against absolute value of capital limit
        elif new_exposure > capital_limit:
            logger.warning(f"Trade rejected: {symbol} exposure would be {new_exposure}, exceeding capital limit {capital_limit}")
            return False
            
        logger.info(f"Trade approved: {symbol} exposure will be {new_exposure}")
        return True
        
    def update_exposure(self, symbol, amount, trade_type, price=None):
        """
        Update the current exposure after a trade has been executed.
        
        Args:
            symbol (str): The trading pair symbol
            amount (float): The size of the trade in base currency
            trade_type (str): Type of trade ('buy' or 'sell')
            price (float, optional): The execution price
        """
        if symbol not in self.current_exposures:
            self.current_exposures[symbol] = 0.0
            
        if trade_type.lower() == 'buy':
            self.current_exposures[symbol] += amount
        elif trade_type.lower() == 'sell':
            self.current_exposures[symbol] -= amount
            
        # Record the trade
        trade_record = {
            'timestamp': datetime.now(),
            'symbol': symbol,
            'amount': amount,
            'type': trade_type,
            'price': price
        }
        self.trade_history.append(trade_record)
        
        logger.info(f"Exposure updated: {symbol} now at {self.current_exposures[symbol]}")
        
    def record_pnl(self, pnl_amount, portfolio_value):
        """
        Record profit/loss and check against daily loss limits.
        
        Args:
            pnl_amount (float): The realized profit/loss amount
            portfolio_value (float): Current total portfolio value
            
        Returns:
            bool: True if trading can continue, False if daily limit reached
        """
        # Reset daily PnL if it's a new day
        current_time = datetime.now()
        if current_time.date() > self.last_reset.date():
            logger.info(f"Resetting daily PnL tracking. Previous: {self.daily_pnl}")
            self.daily_pnl = 0.0
            self.last_reset = current_time
            
        # Update daily PnL
        self.daily_pnl += pnl_amount
        daily_pnl_pct = self.daily_pnl / portfolio_value
        
        logger.info(f"Daily PnL: {self.daily_pnl} ({daily_pnl_pct:.2%} of portfolio)")
        
        # Check if we've hit the daily loss limit
        if daily_pnl_pct < -self.max_daily_loss:
            logger.warning(f"Daily loss limit reached: {daily_pnl_pct:.2%}. Pausing trading for safety.")
            self.in_cooldown = True
            self.cooldown_end_time = current_time + self.cooldown_duration
            return False
            
        # Check for max drawdown
        if pnl_amount < 0 and abs(pnl_amount) / portfolio_value > self.drawdown_threshold:
            logger.warning(f"Large drawdown detected: {abs(pnl_amount) / portfolio_value:.2%}. Pausing trading temporarily.")
            self.in_cooldown = True
            self.cooldown_end_time = current_time + self.cooldown_duration
            return False
            
        return True
        
    def get_exposure_summary(self):
        """
        Get a summary of current exposures.
        
        Returns:
            dict: Current exposures by symbol
        """
        return self.current_exposures
        
    def analyze_trade_history(self, timeframe=None):
        """
        Analyze trade history to identify patterns and risk factors.
        
        Args:
            timeframe (str, optional): Timeframe for analysis (e.g., '1d', '7d')
            
        Returns:
            dict: Analysis results
        """
        if not self.trade_history:
            return {"message": "No trade history available"}
            
        # Convert trade history to DataFrame for analysis
        df = pd.DataFrame(self.trade_history)
        
        # Filter by timeframe if specified
        if timeframe:
            if timeframe == '1d':
                cutoff = datetime.now() - timedelta(days=1)
            elif timeframe == '7d':
                cutoff = datetime.now() - timedelta(days=7)
            else:
                cutoff = datetime.now() - timedelta(days=30)  # Default 30d
                
            df = df[df['timestamp'] >= cutoff]
            
        # Calculate basic statistics
        total_trades = len(df)
        trade_volume = df['amount'].sum()
        symbols_traded = df['symbol'].nunique()
        
        by_symbol = df.groupby('symbol').agg({
            'amount': 'sum',
            'timestamp': 'count'
        }).rename(columns={'timestamp': 'trade_count'})
        
        by_type = df.groupby('type').agg({
            'amount': 'sum',
            'timestamp': 'count'
        }).rename(columns={'timestamp': 'trade_count'})
        
        return {
            "total_trades": total_trades,
            "trade_volume": trade_volume,
            "symbols_traded": symbols_traded,
            "by_symbol": by_symbol.to_dict(),
            "by_type": by_type.to_dict()
        }
    
    def integrate_with_decision_maker(self, decision_maker):
        """
        Integrate risk management with the decision maker for safer trading.
        
        Args:
            decision_maker: The DecisionMaker instance to integrate with
        """
        # Store original decide method
        original_decide = decision_maker.decide
        
        # Override with risk-aware version
        def risk_aware_decide(signals, symbol=None, current_price=None):
            # Get the original decision
            decision = original_decide(signals, symbol, current_price)
            
            # If we're in cooldown, override to hold
            if self.in_cooldown:
                logger.warning(f"Decision overridden due to risk management cooldown. Original: {decision}, New: hold")
                return "hold"
                
            return decision
            
        # Apply the override
        decision_maker.decide = risk_aware_decide
        logger.info("Risk manager successfully integrated with decision maker")