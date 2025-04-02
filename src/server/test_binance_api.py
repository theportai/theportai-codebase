from binance.client import Client  # type: ignore
import hvac  # type: ignore
import os

# Initialize Vault client only once
client = hvac.Client(url="http://127.0.0.1:8200")
client.token = os.getenv("VAULT_TOKEN")  # Ensure VAULT_TOKEN is set in your environment

def get_binance_api_key():
    # Fetch the API key from Vault
    secret = client.secrets.kv.read_secret_version(path='binance-api-key')  # Corrected path
    return secret['data']['data']['api_key']

def get_binance_secret_key():
    # Fetch the secret key from Vault
    secret = client.secrets.kv.read_secret_version(path='binance-api-key')  # Corrected path
    return secret['data']['data']['api_secret']

def test_binance_api():
    # Retrieve API keys
    api_key = get_binance_api_key()
    api_secret = get_binance_secret_key()

    # Initialize Binance client with the API keys
    client = Client(api_key, api_secret)

    # Test a simple API call to fetch all tickers
    prices = client.get_all_tickers()
    print(prices)  # Print out the list of all tickers

# Run the test
if __name__ == "__main__":
    test_binance_api()