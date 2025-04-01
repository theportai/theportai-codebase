class PortfolioReporter:
    def __init__(self, asset_managers, asset_accuracy):
        self.asset_managers = asset_managers
        self.asset_accuracy = asset_accuracy  # Add asset accuracy tracking

    def generate_report(self):
        total_balance = 0
        total_pnl = 0
        total_trades = 0
        total_wins = 0

        # Iterate through assets and calculate performance
        for asset_key, asset in self.asset_managers.items():
            # Calculate USD value of the asset
            usd_value = asset.balance + (asset.holdings * asset.last_price)
            total_balance += usd_value
            total_pnl += (asset.balance - 10000)  # Assuming 10000 as starting balance
            total_trades += len(asset.trade_history)
            total_wins += asset.calculate_wins()

            # Fetch per-asset accuracy from the asset_accuracy dictionary
            accuracy = self.asset_accuracy.get(asset_key, {"correct_predictions": 0, "total_predictions": 1})
            accuracy_percentage = (accuracy["correct_predictions"] / accuracy["total_predictions"]) * 100

            # Print per-asset data and accuracy
            print(f"[{asset_key}] USD Value: ${usd_value:.2f}, PnL: ${asset.balance - 10000:.2f}, Trades: {len(asset.trade_history)}, Accuracy: {accuracy_percentage:.2f}%")

        # Print overall portfolio summary
        print("\n🧑‍💼 Portfolio Summary:")
        print(f"Total Balance: ${total_balance:.2f}")
        print(f"Total PnL: ${total_pnl:.2f}")
        print(f"Total Trades: {total_trades}")
        print(f"Total Wins: {total_wins}")
        
        # Optionally, print overall accuracy for all assets
        total_accuracy = sum([self.asset_accuracy[asset]["correct_predictions"] for asset in self.asset_accuracy.values()])
        total_predictions = sum([self.asset_accuracy[asset]["total_predictions"] for asset in self.asset_accuracy.values()])
        overall_accuracy = (total_accuracy / total_predictions) * 100 if total_predictions > 0 else 0
        print(f"Overall Accuracy: {overall_accuracy:.2f}%")