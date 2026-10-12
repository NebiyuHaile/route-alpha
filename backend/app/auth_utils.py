import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import AUTH_SECRET_KEY, AUTH_TOKEN_EXPIRE_HOURS

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
    try:
        return _PASSWORD_HASHER.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return True


def create_access_token(user_id: str, email: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    expires_at = datetime.now(UTC) + timedelta(hours=AUTH_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": int(expires_at.timestamp()),
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

    signing_input = f"{encoded_header}.{encoded_payload}"
    expected_signature = hmac.new(
        AUTH_SECRET_KEY.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    actual_signature = _b64url_decode(encoded_signature)

    if not hmac.compare_digest(actual_signature, expected_signature):
        raise ValueError("Invalid token signature.")

    payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
    if int(payload.get("exp", 0)) < int(datetime.now(UTC).timestamp()):
        raise ValueError("Token expired.")

    return payload
