import base64
import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import (
    AUTH_SECRET_KEY,
    AUTH_TOKEN_AUDIENCE,
    AUTH_TOKEN_EXPIRE_HOURS,
    AUTH_TOKEN_ISSUER,
)

_PASSWORD_HASHER = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16,
)
_LEGACY_PBKDF2_ITERATIONS = 120000


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def hash_password(password: str) -> str:
    """Hash a new password with Argon2id."""
    return _PASSWORD_HASHER.hash(password)


def _verify_legacy_pbkdf2_password(password: str, stored_hash: str) -> bool:
    """Verify the former hash format so existing accounts can migrate safely."""
    try:
        salt, expected_hash = stored_hash.split("$", maxsplit=1)
    except ValueError:
        return False

    candidate_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        _LEGACY_PBKDF2_ITERATIONS,
    ).hex()
    return hmac.compare_digest(candidate_hash, expected_hash)


def verify_password(password: str, stored_hash: str) -> bool:
    if stored_hash.startswith("$argon2"):
        try:
            return _PASSWORD_HASHER.verify(stored_hash, password)
        except (InvalidHashError, VerificationError):
            return False
    return _verify_legacy_pbkdf2_password(password, stored_hash)


def password_needs_rehash(stored_hash: str) -> bool:
    """Return true for all legacy hashes and outdated Argon2id parameters."""
    if not stored_hash.startswith("$argon2"):
        return True


def create_email_verification_token() -> str:
    """Create an opaque, high-entropy token that is safe to send by email."""
    return secrets.token_urlsafe(32)


def hash_email_verification_token(token: str) -> str:
    """Persist only a SHA-256 digest of a verification token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_recovery_codes(count: int = 10) -> list[str]:
    """Create high-entropy, one-time recovery codes for a TOTP-protected account."""
    return [secrets.token_urlsafe(12) for _ in range(count)]


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()
    try:
        return _PASSWORD_HASHER.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return True


def create_access_token(user_id: str, email: str, token_version: int) -> str:
    """Issue a short-lived, purpose-bound access token for the current user session."""
    header = {"alg": "HS256", "typ": "JWT"}
    issued_at = datetime.now(UTC)
    expires_at = issued_at + timedelta(hours=AUTH_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "iss": AUTH_TOKEN_ISSUER,
        "aud": AUTH_TOKEN_AUDIENCE,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": str(uuid4()),
        "ver": token_version,
    }

    encoded_header = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    encoded_payload = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{encoded_header}.{encoded_payload}"
    signature = hmac.new(
        AUTH_SECRET_KEY.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def decode_access_token(token: str) -> dict[str, str | int]:
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
    except ValueError as exc:
        raise ValueError("Invalid token format.") from exc

    try:
        header = json.loads(_b64url_decode(encoded_header).decode("utf-8"))
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid token header.") from exc
    if header != {"alg": "HS256", "typ": "JWT"}:
        raise ValueError("Invalid token header.")

    signing_input = f"{encoded_header}.{encoded_payload}"
    expected_signature = hmac.new(
        AUTH_SECRET_KEY.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    actual_signature = _b64url_decode(encoded_signature)

    if not hmac.compare_digest(actual_signature, expected_signature):
        raise ValueError("Invalid token signature.")

    try:
        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid token payload.") from exc
    if not isinstance(payload, dict):
        raise ValueError("Invalid token payload.")

    required_string_claims = ("sub", "email", "iss", "aud", "jti")
    if any(not isinstance(payload.get(claim), str) or not payload[claim] for claim in required_string_claims):
        raise ValueError("Invalid token claims.")
    if payload["iss"] != AUTH_TOKEN_ISSUER or payload["aud"] != AUTH_TOKEN_AUDIENCE:
        raise ValueError("Invalid token issuer or audience.")
    try:
        issued_at = int(payload["iat"])
        expires_at = int(payload["exp"])
        token_version = int(payload["ver"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid token claims.") from exc

    now = int(datetime.now(UTC).timestamp())
    if issued_at > now + 60 or expires_at <= issued_at or token_version < 0:
        raise ValueError("Invalid token claims.")
    if expires_at < now:
        raise ValueError("Token expired.")

    return payload
