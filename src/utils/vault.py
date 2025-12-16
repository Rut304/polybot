"""
PolyBot Secrets Vault

Handles symmetric encryption/decryption of user API keys using a Master Key.
This ensures that even if the database is leaked, the actual API keys remain secure.
"""

import os
import base64
import logging
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)

class Vault:
    """
    Client-side encryption wrapper.
    Uses POLYBOT_MASTER_KEY env var to deriving encryption key.
    """
    
    def __init__(self):
        self.master_key = os.environ.get("POLYBOT_MASTER_KEY")
        self._fernet: Optional[Fernet] = None
        
        if self.master_key:
            self._setup_fernet()
        else:
            logger.warning("POLYBOT_MASTER_KEY not set. Vault is effectively disabled (read-only plain text fallback).")

    def _setup_fernet(self):
        """Derive a specific Fernet key from the string master key."""
        # Use a static salt (in production, salt should be unique or stored, 
        # but for simple single-master-key architectures, a fixed salt 
        # ensures deterministic key derivation across restarts)
        # We use the master key itself as salt context if possible, or a fixed string.
        salt = b'polybot_vault_v1' 
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        
        key = base64.urlsafe_b64encode(kdf.derive(self.master_key.encode()))
        self._fernet = Fernet(key)

    def encrypt(self, plain_text: str) -> str:
        """Encrypt a secret string."""
        if not self._fernet:
            raise ValueError("Vault not initialized with POLYBOT_MASTER_KEY")
            
        encrypted = self._fernet.encrypt(plain_text.encode())
        return encrypted.decode('utf-8')

    def decrypt(self, encrypted_text: str) -> str:
        """Decrypt a secret string."""
        if not self._fernet:
            # Fallback: Maybe it's not encrypted? Or we can't decrypt
            logger.warning("Decryption attempted without Master Key")
            return encrypted_text # Return as-is (might fail later)
            
        try:
            # First, check if it looks encrypted (Fernet tokens start with gAAAAA...)
            if not encrypted_text.startswith("gAAAAA"):
                # Assume it's legacy plaintext or different format
                return encrypted_text
                
            decrypted = self._fernet.decrypt(encrypted_text.encode())
            return decrypted.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise

    @staticmethod
    def generate_master_key() -> str:
        """Generate a random 32-byte string info safe primarily for usage as MASTER_KEY."""
        return base64.urlsafe_b64encode(os.urandom(32)).decode('utf-8')
