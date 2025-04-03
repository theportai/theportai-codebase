from src.core.token_manager import TokenManager
from pathlib import Path

TOKEN_FILE = Path("session_tokens/sentiment_token.txt")
TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)

tm = TokenManager()
token = tm.generate_token("sentiment_agent")

# Save token
with open(TOKEN_FILE, "w") as f:
    f.write(token)

print(f"\n🪪 Use this token to test sentiment agent:\n\n{token}\n")
tm.validate_token(token, "sentiment_agent")