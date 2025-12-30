"""
Bootstrap Configuration for PolyBot

Gets Supabase credentials from secure sources:
1. AWS Secrets Manager (production - Lightsail)
2. Environment variables (local development)

NEVER hardcode secrets in this file!
"""

import os
import json
import logging

logger = logging.getLogger(__name__)


def _get_from_aws_secrets_manager():
    """
    Fetch Supabase credentials from AWS Secrets Manager.
    Used in production (Lightsail containers have IAM role access).
    """
    try:
        import boto3
        from botocore.exceptions import ClientError

        # Create a Secrets Manager client
        client = boto3.client(
            service_name='secretsmanager',
            region_name='us-east-1'
        )

        # Try to get the secret
        secret_name = "polybot/supabase"
        response = client.get_secret_value(SecretId=secret_name)

        if 'SecretString' in response:
            secret = json.loads(response['SecretString'])
            logger.info("✓ Loaded Supabase credentials from AWS Secrets Manager")
            return secret.get('url'), secret.get('key')

    except ImportError:
        logger.debug("boto3 not available, skipping AWS Secrets Manager")
    except Exception as e:
        logger.debug(f"AWS Secrets Manager not available: {e}")

    return None, None


def get_bootstrap_config():
    """
    Get bootstrap configuration for Supabase connection.

    Priority:
    1. Environment variables (always checked first - works everywhere)
    2. AWS Secrets Manager (production fallback)

    Returns:
        dict: Contains 'url' and 'key' for Supabase

    NOTE: Only uses SUPABASE_SERVICE_ROLE_KEY (not SUPABASE_KEY/anon key)
    to ensure full database access with RLS bypass.
    """
    # First try environment variables (set by deploy script or .env)
    # ONLY use SERVICE_ROLE_KEY - anon key causes permission issues
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if url and key:
        return {'url': url, 'key': key}

    # Fall back to AWS Secrets Manager (for Lightsail without env vars)
    aws_url, aws_key = _get_from_aws_secrets_manager()
    if aws_url and aws_key:
        return {'url': aws_url, 'key': aws_key}

    # Return empty - will fail gracefully in Database class
    logger.warning("No Supabase credentials found in env vars or AWS Secrets Manager")
    return {'url': None, 'key': None}
