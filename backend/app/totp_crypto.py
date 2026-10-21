"""Encryption helpers for TOTP secrets stored by RouteAlpha."""

from __future__ import annotations

import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import TOTP_ENCRYPTION_KEY

logger = logging.getLogger(__name__)

_PREFIX = "fernet:"


def _fernet() -> Fernet:
    try:
        return Fernet(TOTP_ENCRYPTION_KEY.encode("utf-8"))
    except (TypeError, ValueError) as exc:
        raise RuntimeError("TOTP_ENCRYPTION_KEY must be a valid Fernet key.") from exc


def encrypt_totp_secret(secret: str) -> str:
    """Encrypt a newly generated TOTP secret before database persistence."""
    return _PREFIX + _fernet().encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt_totp_secret(stored_secret: str) -> str:
    """Read an encrypted secret; temporarily support records from before encryption."""
    if not stored_secret.startswith(_PREFIX):
        logger.warning("legacy_plaintext_totp_secret_detected")
        return stored_secret

    try:
        return _fernet().decrypt(stored_secret.removeprefix(_PREFIX).encode("utf-8")).decode(
            "utf-8"
        )
    except InvalidToken as exc:
        raise ValueError("Stored two-factor authentication secret cannot be decrypted.") from exc


def is_encrypted_totp_secret(stored_secret: str | None) -> bool:
    return bool(stored_secret and stored_secret.startswith(_PREFIX))
