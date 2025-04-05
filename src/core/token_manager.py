import uuid
import json
from datetime import datetime, timedelta
from pathlib import Path

TOKEN_STORE = Path("session_tokens/tokens.json")

class TokenManager:
    def __init__(self):
        self.tokens = self._load_tokens()

    def _load_tokens(self):
        if TOKEN_STORE.exists():
            with open(TOKEN_STORE, "r") as f:
                return json.load(f)
        return {}

    def _save_tokens(self):
        with open(TOKEN_STORE, "w") as f:
            json.dump(self.tokens, f, indent=2)

    def generate_token(self, agent_name: str, expires_in=600):
        token = str(uuid.uuid4())
        expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
        self.tokens[token] = {
            "agent": agent_name,
            "expires_at": expires_at,
        }
        self._save_tokens()
        print(f"[🔐 TokenManager] Token generated for {agent_name} (expires at {expires_at})\n")
        print(f"🪪 Use this token to test {agent_name}:\n\n{token}\n")
        return token

    def validate_token(self, token: str, agent_name: str):
        self.tokens = self._load_tokens()  # Always reload latest
        data = self.tokens.get(token)

        if not data:
            print(f"[⛔ TokenManager] Token {token} not found.")
            return False

        if data["agent"] != agent_name:
            print(f"[⛔ TokenManager] Agent mismatch for token {token}.")
            return False

        if datetime.utcnow() > datetime.fromisoformat(data["expires_at"]):
            print(f"[⛔ TokenManager] Token expired for {agent_name}.")
            del self.tokens[token]
            self._save_tokens()
            return False

        print(f"[✅ TokenManager] Token validated for {agent_name}")
        return True