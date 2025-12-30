"""
PolyBot Multi-Tenant Manager (Orchestrator)

This service is responsible for:
1. Identifying active users/bots from the database.
2. Spawning and managing independent PolybotRunner instances for each user.
3. Monitoring health and restarting failed instances.
"""

import asyncio
import logging
import signal
import sys
import os
from typing import Dict, List, Optional
from datetime import datetime

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database.client import Database
from src.bot_runner import PolybotRunner
from src.logging_handler import setup_database_logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("manager")


class BotManager:
    """
    Orchestrates multiple PolyBot instances, one per user.
    """

    def __init__(self):
        self.running = False
        self.bots: Dict[str, PolybotRunner] = {}  # user_id -> runner
        self.tasks: Dict[str, asyncio.Task] = {}   # user_id -> task

        # System-level database connection (no user_id)
        self.db = Database()

    async def get_active_users(self) -> List[str]:
        """Fetch user_ids of all active bots from polybot_status."""
        if not self.db._client:
            logger.error("Database not connected")
            return []

        try:
            # Query users where is_running = True
            # Note: We query the table directly using service_role key
            response = self.db._client.table("polybot_status").select("user_id").eq("is_running", True).execute()

            users = []
            if response.data:
                for row in response.data:
                    uid = row.get("user_id")
                    if uid:
                        users.append(uid)

            # Legacy support: if no user_id column or NULL entries (and we want to run global bot)
            # For now, we strictly look for UUIDs.
            # If migration 001_multi_tenancy.sql ran, user_id should be present.

            return users

        except Exception as e:
            logger.error(f"Failed to fetch active users: {e}")
            return []

    async def start_bot_for_user(self, user_id: str):
        """Initialize and start a bot instance for a specific user."""
        if user_id in self.bots:
            return  # Already running

        logger.info(f"🚀 Starting bot for user {user_id}...")

        try:
            # Instantiate runner with user context
            bot = PolybotRunner(user_id=user_id)

            # Initialize async components
            await bot.initialize()

            # Start the main loop (assuming PolybotRunner needs a run method or we explicitly start its components)
            # PolybotRunner currently has `initialize()` but no explicit "run_forever" loop method exposed cleanly?
            # It starts tasks in `start()` if we look at src/main.py logic vs src/bot_runner.py structure.
            # Looking at src/bot_runner.py, it seems we might need to add a proper `run()` method OR call the tasks directly.

            # HACK: Use the logic from main.py equivalent but adapted for BotRunner
            # For now, we'll store specific components we want to "run"

            # Create a wrapper task that keeps the bot alive
            task = asyncio.create_task(self._run_bot_lifecycle(bot, user_id))

            self.bots[user_id] = bot
            self.tasks[user_id] = task
            logger.info(f"✅ Bot started for user {user_id}")

        except Exception as e:
            logger.error(f"❌ Failed to start bot for user {user_id}: {e}")

    async def _run_bot_lifecycle(self, bot: PolybotRunner, user_id: str):
        """Keep the bot instance running."""
        try:
            # Ensure bot has run method
            if hasattr(bot, 'run'):
                logger.info(f"▶️ Starting active loop for user {user_id}")
                await bot.run()
            else:
                logger.error(f"❌ Bot for user {user_id} has no run() method!")

        except asyncio.CancelledError:
            logger.info(f"Bot task cancelled for user {user_id}")
            # Ensure proper shutdown
            if hasattr(bot, 'shutdown'):
                await bot.shutdown()

        except Exception as e:
            logger.error(f"Bot crashed for user {user_id}: {e}")
            import traceback
            traceback.print_exc()
            # Restart policy could be implemented here (e.g., exponential backoff)

    async def stop_bot_for_user(self, user_id: str):
        """Stop a user's bot instance."""
        if user_id in self.tasks:
            logger.info(f"🛑 Stopping bot for user {user_id}...")
            task = self.tasks[user_id]
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            # Cleanup bot resources if needed
            # if hasattr(self.bots[user_id], 'stop'):
            #     await self.bots[user_id].stop()

            del self.bots[user_id]
            del self.tasks[user_id]
            logger.info(f"Bot stopped for user {user_id}")

    async def run(self):
        """Main orchestrator loop."""
        self.running = True
        logger.info("Manager service started. Monitoring active users...")

        while self.running:
            try:
                current_active_users = set(await self.get_active_users())
                running_users = set(self.bots.keys())

                # Start new bots
                users_to_start = current_active_users - running_users
                for uid in users_to_start:
                    await self.start_bot_for_user(uid)

                # Stop disabled bots
                users_to_stop = running_users - current_active_users
                for uid in users_to_stop:
                    await self.stop_bot_for_user(uid)

                await asyncio.sleep(10)  # Check every 10 seconds

            except Exception as e:
                logger.error(f"Manager loop error: {e}")
                await asyncio.sleep(5)

    def stop(self):
        self.running = False


async def main():
    manager = BotManager()

    # Handle signals
    def signal_handler():
        manager.stop()

    loop = asyncio.get_running_loop()
    # loop.add_signal_handler(signal.SIGINT, signal_handler)
    # loop.add_signal_handler(signal.SIGTERM, signal_handler)

    await manager.run()

if __name__ == "__main__":
    asyncio.run(main())
