import numpy as np # type: ignore

def calculate_sharpe_ratio(returns, risk_free_rate=0.01):
    """
    Calculates the Sharpe Ratio:
    - returns: list of trade-level returns (as decimals, not %)
    - risk_free_rate: typically ~0.01 (1%)
    """
    if len(returns) < 2:
        return 0  # not enough data to compute std deviation

    excess_returns = np.array(returns) - risk_free_rate
    std_dev = np.std(returns)

    if std_dev == 0:
        return 0

    sharpe_ratio = np.mean(excess_returns) / std_dev
    return round(sharpe_ratio, 3)