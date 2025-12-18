
import boto3
import json
import os
import logging
from typing import Dict, Any, Optional
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class SecretsManager:
    """
    AWS Secrets Manager client for fetching configuration and API keys at runtime.
    This replaces local .env files in production environments.
    """
    def __init__(self, region_name: str = "us-east-1"):
        self.region_name = region_name
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                service_name='secretsmanager',
                region_name=self.region_name
            )
        return self._client

    def get_secret(self, secret_name: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a secret by name.
        """
        try:
            logger.info(f"Attempting to fetch secret: {secret_name}")
            response = self.client.get_secret_value(SecretId=secret_name)
        except ClientError as e:
            logger.error(f"Failed to retrieve secret {secret_name}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error retrieving secret {secret_name}: {e}")
            return None

        if 'SecretString' in response:
            try:
                return json.loads(response['SecretString'])
            except json.JSONDecodeError:
                # If it's just a raw string, return it wrapped
                return {"raw_value": response['SecretString']}
        
        return None

# Global instance
# Region defaults to us-east-1 but should be configurable via env var in container
REGION = os.getenv("AWS_REGION", "us-east-1")
secrets_client = SecretsManager(region_name=REGION)
