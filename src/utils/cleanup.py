import logging
import asyncio
from datetime import datetime, timedelta
from src.database.client import Database

logger = logging.getLogger("cleanup")


async def cleanup_stale_data():
    """
    Removes 'detected' opportunities that are older than 1 hour.
    These are considered 'zombies' resulting from a bot crash before processing.
    """
    logger.info("🧹 Starting startup cleanup check...")

    db = Database()

    # Calculate cutoff time (1 hour ago)
    # Note: Supabase/Postgres expects ISO string
    cutoff_time = (datetime.utcnow() - timedelta(hours=1)).isoformat()

    try:
        # We want to delete: status = 'detected' AND created_at < cutoff_time
        # Supabase-py 'delete' works with filters.

        # 1. First count them (optional, but good for logging)
        # Using service_role key via Database client (assuming it uses it if available)

        # NOTE: The Supabase Python client chain is: .table().delete().eq().lt().execute()
        response = db.client.table("polybot_opportunities") \
            .delete(count='exact') \
            .eq("status", "detected") \
            .lt("created_at", cutoff_time) \
            .execute()

        count = response.count if response.count is not None else len(response.data)

        if count > 0:
            logger.info(f"✨ Cleaned up {count} stale 'detected' opportunities (Zombies).")
        else:
            logger.info("✅ No stale data found.")

    except Exception as e:
        logger.error(f"❌ Failed to cleanup stale data: {e}")

if __name__ == "__main__":
    # Test run
    logging.basicConfig(level=logging.INFO)
    asyncio.run(cleanup_stale_data())
