"""
PolyBot Database Logging Handler

Writes log messages to Supabase polybot_bot_logs table for viewing in admin UI.
Only logs INFO level and above to avoid overwhelming the database.
"""

import logging
import os
import json
from datetime import datetime
from typing import Optional
import asyncio
from functools import lru_cache

# Import Supabase client lazily to avoid circular imports
_supabase_client = None

def get_supabase_client():
    """Get or create Supabase client for logging."""
    global _supabase_client
    if _supabase_client is None:
        try:
            from supabase import create_client
            
            url = os.environ.get("SUPABASE_URL", "")
            key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
            
            if url and key:
                _supabase_client = create_client(url, key)
                print("[DB-LOG] Supabase logging client initialized")
        except Exception as e:
            print(f"Failed to create Supabase client for logging: {e}")
    return _supabase_client


# Track if database logging has failed permanently
_db_logging_disabled = False


class DatabaseLogHandler(logging.Handler):
    """
    Custom logging handler that writes logs to Supabase.
    
    Features:
    - Batches logs to reduce database writes
    - Only logs INFO and above
    - Includes component/logger name
    - Includes session_id for correlation
    - Non-blocking async writes
    """
    
    def __init__(self, session_id: Optional[str] = None, user_id: Optional[str] = None, min_level: int = logging.INFO):
        super().__init__(level=min_level)
        self.session_id = session_id or datetime.now().strftime("%Y%m%d_%H%M%S")
        self.user_id = user_id
        self._buffer = []
        self._buffer_size = 10  # Flush every N logs
        self._flush_interval = 30  # Or every N seconds
        self._last_flush = datetime.now()
        self._loop = None
        
    def emit(self, record: logging.LogRecord):
        """Handle a log record."""
        try:
            # Map Python log levels to our severity
            level_map = {
                logging.DEBUG: 'debug',
                logging.INFO: 'info',
                logging.WARNING: 'warning',
                logging.ERROR: 'error',
                logging.CRITICAL: 'critical',
            }
            
            level = level_map.get(record.levelno, 'info')
            
            # Extract component from logger name
            component = record.name.replace('polybot.', '').replace('.', '_')
            if component == 'polybot':
                component = 'main'
            
            # Build details dict
            details = {}
            if record.exc_info:
                import traceback
                details['exception'] = ''.join(traceback.format_exception(*record.exc_info))
            if hasattr(record, 'trade_id'):
                details['trade_id'] = record.trade_id
            if hasattr(record, 'market_id'):
                details['market_id'] = record.market_id
            if hasattr(record, 'extra_data'):
                details.update(record.extra_data)
            
            log_entry = {
                'level': level,
                'component': component,
                'message': record.getMessage()[:2000],  # Truncate long messages
                'details': details if details else None,
                'session_id': self.session_id,
            }
            
            if self.user_id:
                log_entry['user_id'] = self.user_id
            
            self._buffer.append(log_entry)
            
            # Flush if buffer is full or enough time has passed
            should_flush = (
                len(self._buffer) >= self._buffer_size or
                (datetime.now() - self._last_flush).seconds >= self._flush_interval or
                level in ('error', 'critical')  # Always flush errors immediately
            )
            
            if should_flush:
                self._flush()
                
        except Exception as e:
            # Don't let logging errors crash the bot
            print(f"Database log handler error: {e}")
    
    def _flush(self):
        """Flush buffered logs to database."""
        global _db_logging_disabled
        
        if not self._buffer or _db_logging_disabled:
            self._buffer.clear()
            return
        
        client = get_supabase_client()
        if not client:
            self._buffer.clear()
            return
        
        logs_to_write = self._buffer[:]
        self._buffer.clear()
        self._last_flush = datetime.now()
        
        try:
            # Write in a non-blocking way if possible
            result = client.table('polybot_bot_logs').insert(logs_to_write).execute()
        except Exception as e:
            error_str = str(e)
            # If auth error, disable database logging permanently for this session
            if '401' in error_str or 'Invalid API key' in error_str:
                _db_logging_disabled = True
                print("Database logging disabled - auth error (bot continues normally)")
            else:
                # Don't spam errors - only print occasionally
                pass
    
    def close(self):
        """Flush remaining logs on close."""
        self._flush()
        super().close()


def setup_database_logging(session_id: Optional[str] = None, user_id: Optional[str] = None):
    """
    Set up database logging for the bot.
    
    Call this after basic logging is configured.
    """
    # Only add if SUPABASE is configured
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    
    if not url or not key:
        print("Skipping database logging - SUPABASE not configured")
        return None
    
    handler = DatabaseLogHandler(session_id=session_id, user_id=user_id)
    handler.setFormatter(logging.Formatter("%(message)s"))
    
    # Add to root logger
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    
    # Also add to polybot logger
    polybot_logger = logging.getLogger("polybot")
    polybot_logger.addHandler(handler)
    
    return handler


def log_with_context(logger: logging.Logger, level: int, msg: str, 
                      trade_id: Optional[str] = None,
                      market_id: Optional[str] = None,
                      **kwargs):
    """
    Log a message with additional context that will be stored in the database.
    
    Example:
        log_with_context(logger, logging.INFO, "Trade executed", 
                        trade_id="abc123", market_id="polymarket-123",
                        profit=12.50)
    """
    extra = {'extra_data': kwargs}
    if trade_id:
        extra['trade_id'] = trade_id
    if market_id:
        extra['market_id'] = market_id
    
    logger.log(level, msg, extra=extra)
