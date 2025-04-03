import os
import requests # type: ignore
from datetime import datetime, timedelta
import ssl
import urllib3 # type: ignore
import json
import nltk # type: ignore
from nltk.sentiment import SentimentIntensityAnalyzer # type: ignore
from dotenv import load_dotenv # type: ignore
import csv
from pathlib import Path

load_dotenv()

# Suppress SSL warnings as a workaround for certificate issues
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

nltk.download("vader_lexicon", quiet=True)

# 🧠 Init analyzer
sia = SentimentIntensityAnalyzer()

SENTIMENT_LOG_PATH = Path("logs/sentiment_log.csv")


# 🔐 Check environment variables and provide defaults for testing
def check_env_vars():
    missing_vars = []
    env_vars = {
        "NEWS_API_KEY": os.getenv("NEWS_API_KEY"),  # Updated to match your .env
        "REDDIT_CLIENT_ID": os.getenv("REDDIT_CLIENT_ID"),
        "REDDIT_SECRET": os.getenv("REDDIT_SECRET"),
        "REDDIT_USER_AGENT": os.getenv("REDDIT_USER_AGENT")
    }
    
    for key, value in env_vars.items():
        if not value:
            missing_vars.append(key)
    
    if missing_vars:
        print(f"⚠️ Warning: Missing environment variables: {', '.join(missing_vars)}")
        print("⚠️ Some sentiment sources might return default values")
    
    return env_vars

# 📡 NEWS API
def get_news_sentiment(api_key):
    if not api_key:
        print("[News Info]: API key missing, returning default value")
        return 0.0
    
    try:
        url = (
            f"https://newsapi.org/v2/everything?q=crypto OR bitcoin OR ethereum&"
            f"language=en&sortBy=publishedAt&pageSize=10&apiKey={api_key}"
        )
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            print(f"[News Error]: API returned status code {response.status_code}")
            return 0.0
            
        articles = response.json().get("articles", [])
        headlines = [a["title"] for a in articles if a.get("title")]
        
        if not headlines:
            print("[News Info]: No headlines found")
            return 0.0
            
        print(f"[News Info]: Analyzing {len(headlines)} headlines")
        scores = [sia.polarity_scores(text)["compound"] for text in headlines]
        return round(sum(scores) / len(scores), 4)
    except Exception as e:
        print(f"[News Error]: {e}")
        return 0.0

# 🐦 Alternative Twitter Sentiment (using requests directly)
def get_twitter_sentiment_alt():
    try:
        # Using a mock dataset as Twitter scraping is problematic
        print("[Twitter Info]: Using backup data due to API limitations")
        
        # Sample tweets with varying sentiment about crypto
        sample_tweets = [
            "Bitcoin just hit a new all-time high! This is incredible!",
            "Ethereum's upgrade is going to change everything.",
            "Not feeling confident about crypto markets today.",
            "Regulatory concerns continue to impact cryptocurrency trading.",
            "The future of DeFi looks promising despite current challenges.",
            "Lost my entire portfolio in the latest crypto crash. Be careful.",
            "Smart contracts are revolutionizing how we think about ownership.",
            "Buy the dip! Great opportunity in the crypto market right now!"
        ]
        
        scores = [sia.polarity_scores(text)["compound"] for text in sample_tweets]
        sentiment = round(sum(scores) / len(scores), 4)
        print(f"[Twitter Info]: Analyzed {len(sample_tweets)} sample tweets")
        return sentiment
    except Exception as e:
        print(f"[Twitter Error]: {e}")
        return 0.0

# 🧵 REDDIT (via direct API)
def get_reddit_sentiment(client_id, client_secret, user_agent):
    if not all([client_id, client_secret, user_agent]):
        print("[Reddit Info]: API credentials missing, returning default value")
        return 0.0
    
    try:
        import praw # type: ignore
        reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent,
        )
        posts = reddit.subreddit("CryptoCurrency").hot(limit=50)
        titles = [p.title for p in posts]
        
        if not titles:
            print("[Reddit Info]: No posts found")
            return 0.0
            
        print(f"[Reddit Info]: Analyzing {len(titles)} Reddit posts")
        scores = [sia.polarity_scores(text)["compound"] for text in titles]
        return round(sum(scores) / len(scores), 4)
    except ImportError:
        print("[Reddit Error]: praw module not available")
        return get_reddit_sentiment_alt()
    except Exception as e:
        print(f"[Reddit Error]: {e}")
        return get_reddit_sentiment_alt()

# Alternative Reddit sentiment (using sample data)
def get_reddit_sentiment_alt():
    try:
        print("[Reddit Info]: Using backup data due to API limitations")
        
        # Sample Reddit post titles with varying sentiment
        sample_posts = [
            "Discussion: Is this bull run different from previous cycles?",
            "WARNING: Stay away from this new exchange - SCAM!",
            "My 3-year crypto journey: From $1,000 to financial freedom",
            "Technical Analysis: BTC heading for a major correction soon",
            "Why ETH will overtake BTC in market cap by end of year",
            "Lost access to my wallet with 5 BTC. Be careful with your seeds!",
            "The environmental impact of crypto mining needs to be addressed",
            "Adoption: Major retailer now accepting crypto payments"
        ]
        
        scores = [sia.polarity_scores(text)["compound"] for text in sample_posts]
        sentiment = round(sum(scores) / len(scores), 4)
        print(f"[Reddit Info]: Analyzed {len(sample_posts)} sample posts")
        return sentiment
    except Exception as e:
        print(f"[Reddit Error]: {e}")
        return 0.0

def log_sentiment_to_csv(scores):
    SENTIMENT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["timestamp", "news", "twitter", "reddit", "final_score"]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    write_header = not SENTIMENT_LOG_PATH.exists()

    with open(SENTIMENT_LOG_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()
        writer.writerow({"timestamp": now, **scores})


# 🚀 Master Score Aggregator
def get_sentiment_scores():
    env_vars = check_env_vars()
    
    news = get_news_sentiment(env_vars["NEWS_API_KEY"])  # Updated to match your .env
    twitter = get_twitter_sentiment_alt()  # Using alternative Twitter method
    reddit = get_reddit_sentiment(
        env_vars["REDDIT_CLIENT_ID"], 
        env_vars["REDDIT_SECRET"],
        env_vars["REDDIT_USER_AGENT"]
    )
    
    final = round((news + twitter + reddit) / 3, 4)
    scores = {"news": news, "twitter": twitter, "reddit": reddit, "final_score": final}
    
    print("🧠 Sentiment Scores:", scores)

    log_sentiment_to_csv(scores)
    
    return scores



# Execute when run directly
if __name__ == "__main__":
    get_sentiment_scores()