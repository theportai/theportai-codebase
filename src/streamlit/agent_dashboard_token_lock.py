import streamlit as st
from pathlib import Path
import sys
import os

# Add the project root to the Python path
# This allows imports from the project root
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "../.."))
if project_root not in sys.path:
    sys.path.append(project_root)

# Now import TokenManager from the proper path
from src.core.token_manager import TokenManager

# Initialize TokenManager
tm = TokenManager()

# Session state for user authentication
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False

if not st.session_state.authenticated:
    st.title("🔐 Secure Agent Dashboard Login")

    # Prompt for token input
    token_input = st.text_input("Enter your temporary access token:", type="password")

    if st.button("Verify Token"):
        if tm.validate_token(token_input, agent_name="sentiment_agent"):
            st.session_state.authenticated = True
            st.success("✅ Access granted. Welcome to the dashboard!")
        else:
            st.error("❌ Invalid or expired token. Access denied.")
    st.stop()  # Prevent loading rest of dashboard until authenticated

# If authenticated, show actual dashboard
st.title("📊 Sentiment Agent Dashboard")

# Example: Display token success info
st.success("🎉 You're securely logged in!")

# Load and display logs, charts, or agent metrics
LOG_PATH = Path("logs/sentiment_log.csv")
if LOG_PATH.exists():
    import pandas as pd # type: ignore
    df = pd.read_csv(LOG_PATH)
    st.subheader("📈 Latest Sentiment Logs")
    st.dataframe(df.tail(10))
else:
    st.warning("No sentiment logs found.")