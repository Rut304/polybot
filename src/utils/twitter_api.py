"""
Twitter/X API Utility for PolyBot

Provides methods to:
1. Fetch individual tweets
2. Pull entire threads (conversation chains)
3. Search for tweets from specific accounts
4. Monitor specific accounts for new posts

Uses Twitter API v2 endpoints.
"""

import os
import asyncio
import aiohttp
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class TwitterAPI:
    """
    Twitter/X API v2 client for fetching tweets and threads.

    Usage:
        twitter = TwitterAPI(bearer_token="your_token")

        # Get a single tweet
        tweet = await twitter.get_tweet("2000256552352063830")

        # Get an entire thread
        thread = await twitter.get_thread("2000256552352063830")

        # Search recent tweets
        tweets = await twitter.search_recent("kalshi OR polymarket")
    """

    BASE_URL = "https://api.twitter.com/2"

    # Default fields to request
    TWEET_FIELDS = "conversation_id,author_id,created_at,text,public_metrics,entities"
    USER_FIELDS = "username,name,verified,description"

    def __init__(self, bearer_token: Optional[str] = None):
        """
        Initialize Twitter API client.

        Args:
            bearer_token: Twitter API Bearer Token. If not provided, reads from environment.
        """
        self.bearer_token = bearer_token or os.getenv("TWITTER_BEARER_TOKEN")

        if not self.bearer_token:
            logger.warning("No Twitter Bearer Token provided. Twitter features will be disabled.")

        self._session: Optional[aiohttp.ClientSession] = None

    @property
    def headers(self) -> Dict[str, str]:
        """Get authorization headers."""
        return {
            "Authorization": f"Bearer {self.bearer_token}",
            "Content-Type": "application/json",
        }

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()

    async def _request(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make authenticated request to Twitter API.

        Args:
            endpoint: API endpoint (without base URL)
            params: Query parameters

        Returns:
            JSON response data
        """
        if not self.bearer_token:
            raise ValueError("Twitter Bearer Token not configured")

        session = await self._get_session()
        url = f"{self.BASE_URL}/{endpoint}"

        try:
            async with session.get(url, headers=self.headers, params=params) as response:
                if response.status == 429:
                    # Rate limited
                    reset_time = response.headers.get("x-rate-limit-reset")
                    logger.warning(f"Twitter rate limited. Reset at: {reset_time}")
                    raise Exception("Twitter API rate limited")

                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Twitter API error {response.status}: {error_text}")
                    raise Exception(f"Twitter API error: {response.status}")

                return await response.json()

        except aiohttp.ClientError as e:
            logger.error(f"Twitter API request failed: {e}")
            raise

    async def get_tweet(self, tweet_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch a single tweet by ID.

        Args:
            tweet_id: The numeric tweet ID

        Returns:
            Tweet data including conversation_id, author_id, text, etc.
        """
        params = {
            "tweet.fields": self.TWEET_FIELDS,
            "expansions": "author_id",
            "user.fields": self.USER_FIELDS,
        }

        try:
            response = await self._request(f"tweets/{tweet_id}", params)
            return response.get("data")
        except Exception as e:
            logger.error(f"Failed to fetch tweet {tweet_id}: {e}")
            return None

    async def get_user_id(self, username: str) -> Optional[str]:
        """
        Get user ID from username.

        Args:
            username: Twitter username (without @)

        Returns:
            Numeric user ID
        """
        params = {
            "user.fields": self.USER_FIELDS,
        }

        try:
            response = await self._request(f"users/by/username/{username}", params)
            return response.get("data", {}).get("id")
        except Exception as e:
            logger.error(f"Failed to get user ID for @{username}: {e}")
            return None

    async def get_thread(self, tweet_id: str, max_results: int = 100) -> List[Dict[str, Any]]:
        """
        Fetch an entire thread (conversation) starting from a tweet.

        This fetches the original tweet to get the conversation_id and author_id,
        then searches for all tweets in that conversation from the same author.

        Args:
            tweet_id: ID of any tweet in the thread
            max_results: Maximum number of tweets to retrieve (default 100)

        Returns:
            List of tweets in the thread, ordered chronologically
        """
        # Step 1: Get the original tweet to find conversation_id and author_id
        original_tweet = await self.get_tweet(tweet_id)

        if not original_tweet:
            logger.error(f"Could not fetch original tweet {tweet_id}")
            return []

        conversation_id = original_tweet.get("conversation_id")
        author_id = original_tweet.get("author_id")

        if not conversation_id or not author_id:
            logger.error(f"Tweet {tweet_id} missing conversation_id or author_id")
            return [original_tweet]

        # Step 2: Search for all tweets in this conversation from this author
        # Query: conversation_id:XXX from:YYY
        query = f"conversation_id:{conversation_id} from:{author_id}"

        params = {
            "query": query,
            "max_results": min(max_results, 100),
            "tweet.fields": self.TWEET_FIELDS,
            "expansions": "author_id",
            "user.fields": self.USER_FIELDS,
        }

        try:
            response = await self._request("tweets/search/recent", params)
            tweets = response.get("data", [])

            # Sort by created_at to get chronological order
            tweets.sort(key=lambda t: t.get("created_at", ""))

            logger.info(f"Retrieved {len(tweets)} tweets from thread")
            return tweets

        except Exception as e:
            logger.error(f"Failed to fetch thread for conversation {conversation_id}: {e}")
            # Return at least the original tweet
            return [original_tweet]

    async def search_recent(
        self,
        query: str,
        max_results: int = 100,
        since_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search recent tweets (last 7 days).

        Args:
            query: Search query (e.g., "kalshi OR polymarket")
            max_results: Maximum results (10-100)
            since_id: Only return tweets after this ID

        Returns:
            List of matching tweets
        """
        params = {
            "query": query,
            "max_results": min(max(max_results, 10), 100),
            "tweet.fields": self.TWEET_FIELDS,
            "expansions": "author_id",
            "user.fields": self.USER_FIELDS,
        }

        if since_id:
            params["since_id"] = since_id

        try:
            response = await self._request("tweets/search/recent", params)
            return response.get("data", [])
        except Exception as e:
            logger.error(f"Search failed for '{query}': {e}")
            return []

    async def get_user_tweets(
        self,
        user_id: str,
        max_results: int = 100,
        since_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get recent tweets from a specific user.

        Args:
            user_id: Numeric user ID
            max_results: Maximum results (5-100)
            since_id: Only return tweets after this ID

        Returns:
            List of user's tweets
        """
        params = {
            "max_results": min(max(max_results, 5), 100),
            "tweet.fields": self.TWEET_FIELDS,
            "expansions": "author_id",
            "user.fields": self.USER_FIELDS,
        }

        if since_id:
            params["since_id"] = since_id

        try:
            response = await self._request(f"users/{user_id}/tweets", params)
            return response.get("data", [])
        except Exception as e:
            logger.error(f"Failed to get tweets for user {user_id}: {e}")
            return []

    async def monitor_accounts(
        self,
        usernames: List[str],
        callback,
        poll_interval: int = 60,
    ):
        """
        Monitor specific accounts for new tweets.

        Args:
            usernames: List of usernames to monitor (without @)
            callback: Async function to call with new tweets
            poll_interval: Seconds between polls (default 60)
        """
        # Track last seen tweet for each user
        last_seen: Dict[str, str] = {}

        # Get user IDs
        user_ids = {}
        for username in usernames:
            user_id = await self.get_user_id(username)
            if user_id:
                user_ids[username] = user_id
                logger.info(f"Monitoring @{username} (ID: {user_id})")
            else:
                logger.warning(f"Could not find user @{username}")

        if not user_ids:
            logger.error("No valid users to monitor")
            return

        logger.info(f"Starting Twitter monitor for {len(user_ids)} accounts")

        while True:
            try:
                for username, user_id in user_ids.items():
                    tweets = await self.get_user_tweets(
                        user_id,
                        max_results=10,
                        since_id=last_seen.get(username),
                    )

                    if tweets:
                        # Update last seen
                        last_seen[username] = tweets[0].get("id")

                        # Call callback for each new tweet
                        for tweet in tweets:
                            try:
                                await callback(username, tweet)
                            except Exception as e:
                                logger.error(f"Callback error for @{username}: {e}")

                await asyncio.sleep(poll_interval)

            except Exception as e:
                logger.error(f"Monitor error: {e}")
                await asyncio.sleep(poll_interval)


# Convenience functions
async def fetch_thread(tweet_url: str, bearer_token: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch a Twitter thread from a URL.

    Args:
        tweet_url: Full Twitter/X URL (e.g., https://x.com/user/status/123456)
        bearer_token: Optional bearer token (defaults to env var)

    Returns:
        List of tweets in the thread
    """
    # Extract tweet ID from URL
    # URLs can be twitter.com or x.com
    import re
    match = re.search(r'/status/(\d+)', tweet_url)
    if not match:
        raise ValueError(f"Could not extract tweet ID from URL: {tweet_url}")

    tweet_id = match.group(1)

    api = TwitterAPI(bearer_token)
    try:
        return await api.get_thread(tweet_id)
    finally:
        await api.close()


async def search_prediction_markets() -> List[Dict[str, Any]]:
    """
    Search for recent tweets mentioning prediction markets.

    Returns:
        List of tweets mentioning Kalshi, Polymarket, etc.
    """
    api = TwitterAPI()
    try:
        query = "(kalshi OR polymarket OR predictit) -is:retweet lang:en"
        return await api.search_recent(query, max_results=100)
    finally:
        await api.close()


# Example usage
if __name__ == "__main__":
    async def main():
        api = TwitterAPI()

        # Test fetching a thread
        thread = await api.get_thread("2000256552352063830")
        print(f"Thread has {len(thread)} tweets:")
        for tweet in thread:
            print(f"  - {tweet.get('text', '')[:100]}...")

        await api.close()

    asyncio.run(main())
