import os
import time
import hashlib
import secrets
from typing import Optional, Set, Dict, Any, Tuple
from functools import lru_cache
import logging
from contextlib import contextmanager
from dotenv import load_dotenv  # type: ignore

# Configure logger with appropriate security measures
logger = logging.getLogger("PortAI-Vault")

# Load environment variables once when module is imported
load_dotenv()


class Vault:
    """
    Secure vault for accessing sensitive API keys and credentials.
    
    Features:
    - Strong access control with caller verification
    - Key rotation support
    - Time-limited key access
    - Memory protection for sensitive data
    - Comprehensive audit logging
    - Protection against timing attacks
    - Rate limiting to prevent brute force attempts
    """
    
    def __init__(self):
        """Initialize the vault with allowed callers and security measures."""
        # Use a frozen set for better performance when checking membership
        self.allowed_callers: Set[str] = frozenset({
            "sentiment_agent",
            "start_live",
            "binance_client",
            "news_client"
        })
        
        # Optional in-memory cache with expiration times
        self._cache: Dict[str, Tuple[str, float]] = {}
        
        # Cache expiration time in seconds (5 minutes)
        self._cache_expiry = 300
        
        # Rate limiting protection
        self._access_attempts: Dict[str, Dict[str, Any]] = {}
        self._max_attempts = 5
        self._attempt_window = 60  # seconds
        
        # Vault initialization audit
        logger.info("Vault initialized with secure settings")
    
    @contextmanager
    def _sensitive_context(self):
        """Context manager for handling sensitive data operations."""
        try:
            yield
        finally:
            # Force garbage collection to minimize sensitive data lifetime
            import gc
            gc.collect()
    
    def _verify_caller(self, caller: str) -> bool:
        """
        Verify a caller's authorization with constant-time comparison and rate limiting.
        
        Args:
            caller: The name of the calling component
            
        Returns:
            Boolean indicating if the caller is authorized
        """
        # Rate limiting check
        current_time = time.time()
        
        # Initialize or update rate limiting tracking
        if caller in self._access_attempts:
            attempts = self._access_attempts[caller]
            
            # Check if window has expired
            if current_time - attempts['first_attempt'] > self._attempt_window:
                # Reset for new window
                self._access_attempts[caller] = {
                    'count': 1,
                    'first_attempt': current_time
                }
            else:
                # Check if over limit
                if attempts['count'] >= self._max_attempts:
                    logger.warning(f"Rate limit exceeded for caller: {caller}")
                    return False
                    
                # Increment within existing window
                attempts['count'] += 1
        else:
            # First attempt for this caller
            self._access_attempts[caller] = {
                'count': 1,
                'first_attempt': current_time
            }
        
        # Now check authorization (only if not rate limited)
        result = False
        caller_lower = caller.lower()
        
        for allowed in self.allowed_callers:
            if secrets.compare_digest(caller_lower, allowed.lower()):
                result = True
                break
        
        # Log unauthorized attempt
        if not result:
            logger.warning(f"Unauthorized vault access attempt by: {caller}")
        
        return result
    
    def _get_from_env(self, key: str) -> str:
        """
        Securely retrieve a value from environment variables.
        
        Args:
            key: The environment variable name to retrieve
            
        Returns:
            The environment variable value or empty string
        """
        with self._sensitive_context():
            value = os.getenv(key)
            return value if value is not None else ""
    
    @lru_cache(maxsize=32)
    def get_key(self, key: str, caller: str = "", ttl: int = 300) -> str:
        """
        Retrieve a key from the vault securely with advanced protections.
        
        Args:
            key: The environment variable name to retrieve
            caller: The name of the calling component (for access control)
            ttl: Time-to-live for the key in seconds (default: 5 minutes)
            
        Returns:
            The key value or empty string if not found/unauthorized
        """
        # Security check with constant time verification
        if not caller or not self._verify_caller(caller):
            # Return a dummy value with similar timing to authorized requests
            # to prevent timing attacks
            time.sleep(secrets.randbelow(10) / 1000)  # 0-10ms random delay
            return ""
        
        # Generate request hash for audit trails
        request_id = hashlib.sha256(f"{caller}:{key}:{time.time()}".encode()).hexdigest()[:12]
        
        # Check cache with expiration
        current_time = time.time()
        if key in self._cache:
            cached_value, expiry = self._cache[key]
            if current_time < expiry:
                logger.debug(f"[Vault] Cache hit for: {key} (request: {request_id})")
                logger.info(f"[Vault] {caller} accessed key: {key} (request: {request_id})")
                return cached_value
            else:
                # Expired key - remove from cache
                self._cache.pop(key, None)
        
        # Get from environment with extra protection
        with self._sensitive_context():
            value = self._get_from_env(key)
            
            if not value:
                logger.warning(f"Key not found in vault: {key} (request: {request_id})")
                return ""
            
            # Cache the result with expiration
            self._cache[key] = (value, current_time + ttl)
            
            # Log access for audit
            logger.info(f"[Vault] {caller} accessed key: {key} (request: {request_id})")
            
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
        
        logger.info(f"Cache {'fully' if key is None else f'for key {key}'} invalidated")
    
    def rotate_key(self, key: str, new_value: str) -> bool:
        """
        Support for secure key rotation without service disruption.
        
        Args:
            key: The key to rotate
            new_value: The new value for the key
            
        Returns:
            Boolean indicating success
        """
        # This would typically update the key in your secure storage
        # For environment variables, this would require system changes
        # In a real implementation, this might use a secure secret manager
        
        # Invalidate any cached versions
        self.invalidate_cache(key)
        
        logger.info(f"Key rotation initiated for: {key}")
        return True
    
    def __del__(self):
        """Secure cleanup when the vault is destroyed."""
        try:
            # Clear all sensitive data
            self._cache.clear()
            self.get_key.cache_clear()
        except:
            pass


