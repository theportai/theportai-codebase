import numpy as np # type: ignore

def calculate_sharpe_ratio(returns, risk_free_rate=0.01):
    """
    returns: list of daily (or trade-wise) returns
    risk_free_rate: default 1%
    """
    if len(returns) < 2:
        return 0  # Not enough data

    excess_returns = np.array(returns) - risk_free_rate
    std_dev = np.std(returns)

    if std_dev == 0:
        return 0

    sharpe = np.mean(excess_returns) / std_dev
    return round(sharpe, 3)