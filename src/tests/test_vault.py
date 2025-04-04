import unittest
import time
import os
from unittest.mock import patch, MagicMock
import logging

# Import the Vault class
from src.core.vault import Vault

class TestVault(unittest.TestCase):
    """Test suite for the Vault class functionality and security."""

    def setUp(self):
        """Set up test environment before each test."""
        # Configure test environment variables
        os.environ["TEST_API_KEY"] = "test-api-key-value"
        os.environ["TEST_SECRET"] = "test-secret-value"
        
        # Create a fresh vault instance for each test
        self.vault = Vault()
        
        # Disable logging during tests
        logging.disable(logging.CRITICAL)
    
    def tearDown(self):
        """Clean up after each test."""
        # Remove test environment variables
        os.environ.pop("TEST_API_KEY", None)
        os.environ.pop("TEST_SECRET", None)
        
        # Re-enable logging
        logging.disable(logging.NOTSET)
    
    def test_authorized_access(self):
        """Test that authorized callers can access keys."""
        # Test each authorized caller
        for caller in ["sentiment_agent", "start_live", "binance_client", "news_client"]:
            key_value = self.vault.get_key("TEST_API_KEY", caller)
            self.assertEqual(key_value, "test-api-key-value")
    
    def test_unauthorized_access(self):
        """Test that unauthorized callers cannot access keys."""
        # Test with unauthorized caller
        key_value = self.vault.get_key("TEST_API_KEY", "unauthorized_caller")
        self.assertEqual(key_value, "")
        
        # Test with empty caller
        key_value = self.vault.get_key("TEST_API_KEY", "")
        self.assertEqual(key_value, "")
    
    def test_nonexistent_key(self):
        """Test that nonexistent keys return empty string."""
        key_value = self.vault.get_key("NONEXISTENT_KEY", "sentiment_agent")
        self.assertEqual(key_value, "")
    
    def test_cache_functionality(self):
        """Test that caching works correctly."""
        # First access should hit environment
        with patch('os.getenv') as mock_getenv:
            mock_getenv.return_value = "cached-value"
            key_value = self.vault.get_key("TEST_CACHE", "sentiment_agent")
            self.assertEqual(key_value, "cached-value")
            mock_getenv.assert_called_once()
        
        # Second access should use cache
        with patch('os.getenv') as mock_getenv:
            key_value = self.vault.get_key("TEST_CACHE", "sentiment_agent")
            self.assertEqual(key_value, "cached-value")
            mock_getenv.assert_not_called()
    
    def test_cache_expiration(self):
        """Test that cache entries expire after TTL."""
        # Override _cache_expiry for testing
        self.vault._cache_expiry = 1  # 1 second TTL
        
        # First access caches the key
        key_value = self.vault.get_key("TEST_API_KEY", "sentiment_agent", ttl=1)
        self.assertEqual(key_value, "test-api-key-value")
        
        # Wait for expiration
        time.sleep(1.1)
        
        # Should hit environment again
        with patch('os.getenv') as mock_getenv:
            mock_getenv.return_value = "test-api-key-value"
            key_value = self.vault.get_key("TEST_API_KEY", "sentiment_agent")
            self.assertEqual(key_value, "test-api-key-value")
            mock_getenv.assert_called_once()
    
    def test_invalidate_cache(self):
        """Test that invalidate_cache removes cached entries."""
        # Cache a key
        key_value = self.vault.get_key("TEST_API_KEY", "sentiment_agent")
        self.assertEqual(key_value, "test-api-key-value")
        
        # Invalidate specific key
        self.vault.invalidate_cache("TEST_API_KEY")
        
        # Should hit environment again
        with patch('os.getenv') as mock_getenv:
            mock_getenv.return_value = "test-api-key-value"
            key_value = self.vault.get_key("TEST_API_KEY", "sentiment_agent")
            self.assertEqual(key_value, "test-api-key-value")
            mock_getenv.assert_called_once()
    
    def test_invalidate_all_cache(self):
        """Test that invalidate_cache(None) clears all cached entries."""
        # Cache multiple keys
        self.vault.get_key("TEST_API_KEY", "sentiment_agent")
        self.vault.get_key("TEST_SECRET", "sentiment_agent")
        
        # Invalidate all keys
        self.vault.invalidate_cache()
        
        # Should hit environment for both keys
        with patch('os.getenv') as mock_getenv:
            mock_getenv.return_value = "test-api-key-value"
            self.vault.get_key("TEST_API_KEY", "sentiment_agent")
            self.vault.get_key("TEST_SECRET", "sentiment_agent")
            self.assertEqual(mock_getenv.call_count, 2)
    
    def test_rate_limiting(self):
        """Test that rate limiting functionality works correctly."""
        # Simple test that verifies basic rate limiting functionality
        
        # Create a fresh instance for this test with controlled parameters
        test_vault = Vault()
        test_vault._max_attempts = 3
        test_vault._attempt_window = 2
        
        # Track an unauthorized caller manually in the access attempts dictionary
        caller = "test_unauthorized"
        test_vault._access_attempts[caller] = {
            'count': 3,  # Already at the limit
            'first_attempt': time.time()
        }
        
        # First verify the caller is detected as rate-limited
        self.assertFalse(test_vault._verify_caller(caller))
        
        # Manually reset the counter for testing the expiration
        test_vault._access_attempts[caller]['first_attempt'] = time.time() - 3  # Set time in the past
        
        # After expiration time, should allow attempts again
        self.assertTrue(test_vault._verify_caller(caller) == False)  # Still unauthorized but not rate-limited
        
        # Verify counter was reset
        self.assertEqual(test_vault._access_attempts[caller]['count'], 1)
        
        def test_rotate_key(self):
            """Test key rotation functionality."""
            # This test is limited since we can't actually modify env vars
            result = self.vault.rotate_key("TEST_API_KEY", "new-value")
            self.assertTrue(result)
            
            # Verify cache is invalidated
            self.assertNotIn("TEST_API_KEY", self.vault._cache)

    def test_case_insensitive_caller(self):
        """Test that caller verification is case-insensitive."""
        # Test with different case variations
        key_value = self.vault.get_key("TEST_API_KEY", "Sentiment_Agent")
        self.assertEqual(key_value, "test-api-key-value")
        
        key_value = self.vault.get_key("TEST_API_KEY", "SENTIMENT_AGENT")
        self.assertEqual(key_value, "test-api-key-value")

# Run tests if script is executed directly
if __name__ == "__main__":
    unittest.main()