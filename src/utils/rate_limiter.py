"""
Rate Limiter - Prevents 429 errors with adaptive rate limiting.

Provides:
- Per-API endpoint rate limiting
- Adaptive backoff on 429 responses  
- Async-compatible with thread-safe design
- Configurable limits per service
"""

import asyncio
import time
import logging
from typing import Dict, Optional, Any, Callable
from dataclasses import dataclass, field
from functools import wraps
import threading
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting a specific API."""
    requests_per_minute: int = 60
    requests_per_second: int = 2
    min_interval_seconds: float = 0.5  # Minimum time between requests
    max_retries: int = 3
    initial_backoff: float = 1.0  # Initial backoff on 429
    max_backoff: float = 60.0  # Maximum backoff time
    backoff_multiplier: float = 2.0  # Exponential backoff multiplier


# Default configurations for known APIs
API_CONFIGS: Dict[str, RateLimitConfig] = {
    # Kalshi - Very strict rate limits
    "kalshi": RateLimitConfig(
        requests_per_minute=30,  # Conservative
        requests_per_second=1,
        min_interval_seconds=2.0,  # 2 seconds between requests
        max_retries=5,
        initial_backoff=5.0,
        max_backoff=120.0,
    ),
    # Polymarket - More lenient
    "polymarket": RateLimitConfig(
        requests_per_minute=100,
        requests_per_second=3,
        min_interval_seconds=0.5,
        max_retries=3,
        initial_backoff=1.0,
    ),
    # Twitter/X API
    "twitter": RateLimitConfig(
        requests_per_minute=15,  # Free tier is very limited
        requests_per_second=1,
        min_interval_seconds=4.0,
        max_retries=3,
        initial_backoff=60.0,  # Twitter rate limits are harsh
        max_backoff=900.0,  # 15 minutes
    ),
    # Gamma API (Polymarket discovery)
    "gamma": RateLimitConfig(
        requests_per_minute=60,
        requests_per_second=2,
        min_interval_seconds=1.0,
    ),
    # Finnhub
    "finnhub": RateLimitConfig(
        requests_per_minute=60,
        requests_per_second=1,
        min_interval_seconds=1.0,
    ),
    # NewsAPI
    "newsapi": RateLimitConfig(
        requests_per_minute=100,
        requests_per_second=2,
        min_interval_seconds=0.6,
    ),
    # Default for unknown APIs
    "default": RateLimitConfig(
        requests_per_minute=60,
        requests_per_second=2,
        min_interval_seconds=1.0,
    ),
}


@dataclass
class RateLimitState:
    """Tracks rate limit state for an API."""
    last_request_time: float = 0.0
    request_count_minute: int = 0
    minute_window_start: float = 0.0
    current_backoff: float = 0.0
    backoff_until: float = 0.0
    consecutive_429s: int = 0
    lock: threading.Lock = field(default_factory=threading.Lock)


class RateLimiter:
    """
    Adaptive rate limiter for API calls.
    
    Features:
    - Per-API rate limiting with configurable limits
    - Adaptive backoff on 429 responses
    - Thread-safe and async-compatible
    - Automatic request spacing
    
    Usage:
        limiter = RateLimiter()
        
        # Before making a request
        await limiter.wait("kalshi")
        
        # After getting a 429
        limiter.record_rate_limit("kalshi")
        
        # Or use as decorator
        @limiter.rate_limited("kalshi")
        async def fetch_kalshi_markets():
            ...
    """
    
    def __init__(self):
        self._states: Dict[str, RateLimitState] = defaultdict(RateLimitState)
        self._async_locks: Dict[str, asyncio.Lock] = {}
    
    def get_config(self, api_name: str) -> RateLimitConfig:
        """Get rate limit config for an API."""
        return API_CONFIGS.get(api_name.lower(), API_CONFIGS["default"])
    
    def _get_async_lock(self, api_name: str) -> asyncio.Lock:
        """Get or create async lock for API."""
        if api_name not in self._async_locks:
            self._async_locks[api_name] = asyncio.Lock()
        return self._async_locks[api_name]
    
    async def wait(self, api_name: str) -> float:
        """
        Wait if necessary before making a request.
        
        Returns the time waited in seconds.
        """
        config = self.get_config(api_name)
        state = self._states[api_name]
        async_lock = self._get_async_lock(api_name)
        
        async with async_lock:
            now = time.time()
            wait_time = 0.0
            
            # Check if we're in backoff period
            if now < state.backoff_until:
                wait_time = state.backoff_until - now
                logger.info(f"[{api_name}] Rate limited, waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
                now = time.time()
            
            # Check per-minute limit
            if now - state.minute_window_start >= 60:
                # Reset minute window
                state.minute_window_start = now
                state.request_count_minute = 0
            
            if state.request_count_minute >= config.requests_per_minute:
                # Wait until minute window resets
                wait_until = state.minute_window_start + 60
                extra_wait = wait_until - now + 0.1
                if extra_wait > 0:
                    logger.info(f"[{api_name}] Per-minute limit reached, waiting {extra_wait:.1f}s")
                    await asyncio.sleep(extra_wait)
                    wait_time += extra_wait
                    now = time.time()
                    state.minute_window_start = now
                    state.request_count_minute = 0
            
            # Enforce minimum interval between requests
            time_since_last = now - state.last_request_time
            if time_since_last < config.min_interval_seconds:
                extra_wait = config.min_interval_seconds - time_since_last
                await asyncio.sleep(extra_wait)
                wait_time += extra_wait
            
            # Update state
            state.last_request_time = time.time()
            state.request_count_minute += 1
            
            # Log if we're approaching limits
            if state.request_count_minute > config.requests_per_minute * 0.8:
                logger.debug(
                    f"[{api_name}] {state.request_count_minute}/{config.requests_per_minute} "
                    f"requests in current minute"
                )
            
            return wait_time
    
    def record_rate_limit(self, api_name: str, response_code: int = 429):
        """
        Record a rate limit response and update backoff.
        
        Call this when you receive a 429 or similar rate limit error.
        """
        config = self.get_config(api_name)
        state = self._states[api_name]
        
        with state.lock:
            state.consecutive_429s += 1
            
            # Calculate backoff with exponential increase
            state.current_backoff = min(
                config.initial_backoff * (config.backoff_multiplier ** (state.consecutive_429s - 1)),
                config.max_backoff
            )
            
            state.backoff_until = time.time() + state.current_backoff
            
            logger.warning(
                f"[{api_name}] Rate limit hit (429 #{state.consecutive_429s}). "
                f"Backing off for {state.current_backoff:.1f}s"
            )
    
    def record_success(self, api_name: str):
        """
        Record a successful request - resets consecutive 429 counter.
        """
        state = self._states[api_name]
        with state.lock:
            if state.consecutive_429s > 0:
                logger.debug(f"[{api_name}] Request succeeded, resetting backoff")
            state.consecutive_429s = 0
            state.current_backoff = 0.0
    
    def get_stats(self, api_name: str) -> Dict[str, Any]:
        """Get rate limiting stats for an API."""
        config = self.get_config(api_name)
        state = self._states[api_name]
        
        return {
            "api": api_name,
            "requests_per_minute_limit": config.requests_per_minute,
            "current_minute_count": state.request_count_minute,
            "consecutive_429s": state.consecutive_429s,
            "current_backoff": state.current_backoff,
            "backoff_until": state.backoff_until,
            "last_request": state.last_request_time,
        }
    
    def rate_limited(self, api_name: str):
        """
        Decorator for rate-limited async functions.
        
        Usage:
            @rate_limiter.rate_limited("kalshi")
            async def fetch_markets():
                ...
        """
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                await self.wait(api_name)
                try:
                    result = await func(*args, **kwargs)
                    self.record_success(api_name)
                    return result
                except Exception as e:
                    # Check if it's a rate limit error
                    error_str = str(e).lower()
                    if "429" in error_str or "rate limit" in error_str or "too many" in error_str:
                        self.record_rate_limit(api_name)
                    raise
            return wrapper
        return decorator


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get the global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


async def rate_limited_request(
    api_name: str,
    request_func: Callable,
    *args,
    max_retries: int = 3,
    **kwargs
) -> Any:
    """
    Execute a rate-limited request with automatic retry on 429.
    
    Usage:
        result = await rate_limited_request(
            "kalshi",
            session.get,
            "https://api.kalshi.com/v2/markets",
            params={"limit": 100}
        )
    """
    limiter = get_rate_limiter()
    config = limiter.get_config(api_name)
    retries = 0
    
    while retries <= max_retries:
        await limiter.wait(api_name)
        
        try:
            result = await request_func(*args, **kwargs)
            
            # Check if result is an aiohttp response
            if hasattr(result, 'status'):
                if result.status == 429:
                    limiter.record_rate_limit(api_name, 429)
                    retries += 1
                    if retries <= max_retries:
                        logger.info(f"[{api_name}] Retrying after 429 ({retries}/{max_retries})")
                        continue
                    raise Exception(f"Rate limit exceeded after {max_retries} retries")
                else:
                    limiter.record_success(api_name)
            else:
                limiter.record_success(api_name)
            
            return result
            
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str:
                limiter.record_rate_limit(api_name, 429)
                retries += 1
                if retries <= max_retries:
                    logger.info(f"[{api_name}] Retrying after rate limit error ({retries}/{max_retries})")
                    continue
            raise
    
    raise Exception(f"[{api_name}] Max retries ({max_retries}) exceeded")
