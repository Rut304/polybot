"""
Bootstrap Configuration for PolyBot

This file contains the minimal credentials needed to connect to Supabase.
All other configuration is pulled from the Supabase database after connection.

This approach allows the bot to run autonomously on AWS Lightsail without
requiring environment variables to be passed on every deployment.

SECURITY NOTE:
- These are service_role keys with full database access
- The Supabase project has Row Level Security (RLS) enabled
- This file is gitignored - never commit actual credentials
- In production, this is baked into the Docker image at build time
"""

# Supabase connection credentials
# These are the only credentials needed to bootstrap the bot
# Everything else is pulled from polybot_config and polybot_secrets tables

SUPABASE_URL = "https://ytaltvltxkkfczlvjgad.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YWx0dmx0eGtrZmN6bHZqZ2FkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ0NTA4OCwiZXhwIjoyMDgwMDIxMDg4fQ.eWq6y3iT6DvX9JRzgNxX4N8O7YFZY_9ncRL2gmwefbw"


def get_bootstrap_config():
    """
    Get bootstrap configuration for Supabase connection.
    
    Priority:
    1. Environment variables (for local dev override)
    2. Hardcoded values above (for production Docker)
    
    Returns:
        dict: Contains 'url' and 'key' for Supabase
    """
    import os
    
    return {
        'url': os.getenv('SUPABASE_URL', SUPABASE_URL),
        'key': os.getenv('SUPABASE_KEY', SUPABASE_KEY),
    }
