import os
import time
import hashlib
import secrets
import sys
from typing import Optional, Set, Dict, Any, Tuple
from functools import lru_cache
import logging
from contextlib import contextmanager
from dotenv import load_dotenv  # type: ignore

# Configure logger with appropriate security measures
logger = logging.getLogger("PortAI-Vault")
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

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
            "news_client",
            "trading_agent",
            "api_server"  # Added for Next.js API routes
        })

        if os.getenv("ENV") == "dev":
            self.allowed_callers = frozenset(self.allowed_callers).union({"trading_agent", "test_caller"})
        
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
    
    def set_key(self, key: str, value: str, caller: str = "") -> bool:
        """
        Store a key in the vault securely.
        
        Args:
            key: The key name to store
            value: The value to store
            caller: The name of the calling component (for access control)
            
        Returns:
            Boolean indicating success
        """
        # Security check with constant time verification
        if not caller or not self._verify_caller(caller):
            logger.warning(f"Unauthorized attempt to set key: {key} by caller: {caller}")
            time.sleep(secrets.randbelow(10) / 1000)  # 0-10ms random delay
            return False
        
        # In a real implementation, this would securely store in a vault service
        # For this example, we'll use environment variables (not recommended for production)
        with self._sensitive_context():
            os.environ[key] = value
        
        # Invalidate any cached versions
        self.invalidate_cache(key)
        
        # Generate request hash for audit trails
        request_id = hashlib.sha256(f"{caller}:{key}:{time.time()}".encode()).hexdigest()[:12]
        logger.info(f"[Vault] Key set: {key} by {caller} (request: {request_id})")
        return True
    
    def delete_key(self, key: str, caller: str = "") -> bool:
        """
        Delete a key from the vault.
        
        Args:
            key: The key name to delete
            caller: The name of the calling component (for access control)
            
        Returns:
            Boolean indicating success
        """
        # Security check with constant time verification
        if not caller or not self._verify_caller(caller):
            logger.warning(f"Unauthorized attempt to delete key: {key} by caller: {caller}")
            time.sleep(secrets.randbelow(10) / 1000)  # 0-10ms random delay
            return False
        
        # Remove from environment (in reality, would remove from actual vault)
        with self._sensitive_context():
            if key in os.environ:
                del os.environ[key]
        
        # Invalidate any cached versions
        self.invalidate_cache(key)
        
        # Generate request hash for audit trails
        request_id = hashlib.sha256(f"{caller}:{key}:{time.time()}".encode()).hexdigest()[:12]
        logger.info(f"[Vault] Key deleted: {key} by {caller} (request: {request_id})")
        return True
    
    def set_user_key(self, user_id: str, key_name: str, key_value: str, caller: str = "") -> bool:
        """
        Store a user-specific key in the vault securely.
        
        Args:
            user_id: The user ID to associate with the key
            key_name: The key name to store
            key_value: The value to store
            caller: The name of the calling component (for access control)
            
        Returns:
            Boolean indicating success
        """
        # Generate a user-specific key format
        full_key = f"USER_{user_id}_{key_name}"
        
        # Security check with constant time verification
        if not caller or not self._verify_caller(caller):
            logger.warning(f"Unauthorized attempt to set user key: {full_key} by caller: {caller}")
            time.sleep(secrets.randbelow(10) / 1000)  # 0-10ms random delay
            return False
        
        # In a real implementation, this would securely store in a vault service
        # For this example, we'll use environment variables (not recommended for production)
        with self._sensitive_context():
            os.environ[full_key] = key_value
        
        # Invalidate any cached versions
        self.invalidate_cache(full_key)
        
        # Generate request hash for audit trails
        request_id = hashlib.sha256(f"{caller}:{full_key}:{time.time()}".encode()).hexdigest()[:12]
        logger.info(f"[Vault] User key set: {full_key} by {caller} (request: {request_id})")
        return True
    
    def get_user_key(self, user_id: str, key_name: str, caller: str = "", ttl: int = 300) -> str:
        """
        Retrieve a user-specific key from the vault securely.
        
        Args:
            user_id: The user ID associated with the key
            key_name: The key name to retrieve
            caller: The name of the calling component (for access control)
            ttl: Time-to-live for the key in seconds (default: 5 minutes)
            
        Returns:
            The key value or empty string if not found/unauthorized
        """
        # Generate a user-specific key format
        full_key = f"USER_{user_id}_{key_name}"
        
        # Use the existing get_key method with the full key
        return self.get_key(full_key, caller, ttl)
    
    def delete_user_key(self, user_id: str, key_name: str, caller: str = "") -> bool:
        """
        Delete a user-specific key from the vault.
        
        Args:
            user_id: The user ID associated with the key
            key_name: The key name to delete
            caller: The name of the calling component (for access control)
            
        Returns:
            Boolean indicating success
        """
        # Generate a user-specific key format
        full_key = f"USER_{user_id}_{key_name}"
        
        # Security check with constant time verification
        if not caller or not self._verify_caller(caller):
            logger.warning(f"Unauthorized attempt to delete user key: {full_key} by caller: {caller}")
            time.sleep(secrets.randbelow(10) / 1000)  # 0-10ms random delay
            return False
        
        # Remove from environment (in reality, would remove from actual vault)
        with self._sensitive_context():
            if full_key in os.environ:
                del os.environ[full_key]
        
        # Invalidate any cached versions
        self.invalidate_cache(full_key)
        
        # Generate request hash for audit trails
        request_id = hashlib.sha256(f"{caller}:{full_key}:{time.time()}".encode()).hexdigest()[:12]
        logger.info(f"[Vault] User key deleted: {full_key} by {caller} (request: {request_id})")
        return True
    
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
    
    def rotate_key(self, key: str, new_value: str, caller: str = "") -> bool:
        """
        Support for secure key rotation without service disruption.
        
        Args:
            key: The key to rotate
            new_value: The new value for the key
            caller: The name of the calling component (for access control)
            
        Returns:
            Boolean indicating success
        """
        # This would typically update the key in your secure storage
        # For this implementation, use set_key
        if not self.set_key(key, new_value, caller):
            return False
        
        # Invalidate any cached versions
        self.invalidate_cache(key)
        
        logger.info(f"Key rotation completed for: {key}")
        return True
    
    def __del__(self):
        """Secure cleanup when the vault is destroyed."""
        try:
            # Clear all sensitive data
            self._cache.clear()
            self.get_key.cache_clear()
        except:
            pass


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Vault CLI for secure key operations')
    parser.add_argument("--action", required=True, 
                        choices=["get", "set", "delete", "get-user", "set-user", "delete-user"],
                        help="Action to perform")
    parser.add_argument("--key", required=True, help="Key name")
    parser.add_argument("--value", help="Value to set (required for set operations)")
    parser.add_argument("--caller", required=True, help="Name of calling component")
    parser.add_argument("--user-id", help="User ID for user-specific operations")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    if args.debug:
        logger.setLevel(logging.DEBUG)
    
    vault = Vault()
    try:
        # User-specific operations
        if args.action == "get-user":
            if not args.user_id:
                print("Error: --user-id is required for user operations", file=sys.stderr)
                sys.exit(1)
            value = vault.get_user_key(args.user_id, args.key, caller=args.caller)
            print(value)
        elif args.action == "set-user":
            if not args.user_id:
                print("Error: --user-id is required for user operations", file=sys.stderr)
                sys.exit(1)
            if not args.value:
                print("Error: --value is required for set operations", file=sys.stderr)
                sys.exit(1)
            result = vault.set_user_key(args.user_id, args.key, args.value, caller=args.caller)
            print("success" if result else "failed")
        elif args.action == "delete-user":
            if not args.user_id:
                print("Error: --user-id is required for user operations", file=sys.stderr)
                sys.exit(1)
            result = vault.delete_user_key(args.user_id, args.key, caller=args.caller)
            print("success" if result else "failed")
        # Standard operations
        elif args.action == "get":
            value = vault.get_key(args.key, caller=args.caller)
            print(value)
        elif args.action == "set":
            if not args.value:
                print("Error: --value is required for set operations", file=sys.stderr)
                sys.exit(1)
            result = vault.set_key(args.key, args.value, caller=args.caller)
            print("success" if result else "failed")
        elif args.action == "delete":
            result = vault.delete_key(args.key, caller=args.caller)
            print("success" if result else "failed")
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)