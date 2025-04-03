# src/core/vault.py
import os
from dotenv import load_dotenv # type: ignore
import logging
from typing import Optional, Set, Dict
from functools import lru_cache

# Configure logger
logger = logging.getLogger("PortAI-Vault")

# Load environment variables once when module is imported
load_dotenv()

class Vault:
    """Secure vault for accessing sensitive API keys and credentials."""
    
    def __init__(self):
        """Initialize the vault with allowed callers and optional caching."""
        # Use a frozen set for better performance when checking membership
        self.allowed_callers: Set[str] = frozenset({
            "sentiment_agent", 
            "start_live", 
            "binance_client", 
            "news_client"
        })
        
        # Optional in-memory cache for frequently accessed keys
        self._cache: Dict[str, str] = {}
    
    @lru_cache(maxsize=32)
    def get_key(self, key: str, caller: str = "") -> str:
        """
        Retrieve a key from the vault securely.
        
        Args:
            key: The environment variable name to retrieve
            caller: The name of the calling component (for access control)
            
        Returns:
            The key value or empty string if not found/unauthorized
        """
        # Security check
        if not caller or caller.lower() not in self.allowed_callers:
            logger.warning(f"Unauthorized vault access attempt by: {caller}")
            return ""
        
        # Try cache first (for frequently accessed keys)
        if key in self._cache:
            logger.debug(f"[Vault] Cache hit for: {key}")
            logger.info(f"[Vault] {caller} accessed key: {key}")
            return self._cache[key]
            
        # Get from environment
        value = os.getenv(key)
        if value is None:
            logger.warning(f"Key not found in vault: {key}")
            return ""
            
        # Cache the result for future access
        self._cache[key] = value
        logger.info(f"[Vault] {caller} accessed key: {key}")
        value = os.getenv(key)
        print(f"[Vault] {caller} accessed key: {key}")
        return value
    
    def invalidate_cache(self, key: Optional[str] = None) -> None:
        """
        Invalidate cached keys (useful if keys are rotated).
        
        Args:
            key: Specific key to invalidate, or None to clear all
        """
        if key:
            self._cache.pop(key, None)
            # Also clear the lru_cache for this specific key
            self.get_key.cache_clear()
        else:
            self._cache.clear()
            # Clear all cached results
            self.get_key.cache_clear()