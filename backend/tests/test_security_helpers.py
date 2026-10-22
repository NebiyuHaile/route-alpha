import hashlib
import os
import subprocess
import sys

import pytest
import pyotp
from fastapi.testclient import TestClient
from fastapi import HTTPException
from starlette.requests import Request
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.llm_service import call_model
from app.llm_service import _execute_model_call
from app.config import MODEL_REQUEST_TIMEOUT_SECONDS
from app.auth_utils import (
    create_access_token,
    decode_access_token,
    hash_password,
    password_needs_rehash,
    verify_password,
)
import app.main as main
from app.main import enforce_rate_limit
from app.database import Base
from app.models import ContactRequest, User
from limits import parse
from app.totp_crypto import decrypt_totp_secret, encrypt_totp_secret, is_encrypted_totp_secret


def test_totp_secret_is_encrypted_at_rest_and_round_trips():
    encrypted = encrypt_totp_secret("JBSWY3DPEHPK3PXP")

    assert encrypted != "JBSWY3DPEHPK3PXP"
    assert is_encrypted_totp_secret(encrypted)
    assert decrypt_totp_secret(encrypted) == "JBSWY3DPEHPK3PXP"


def test_provider_errors_do_not_leak_upstream_message(monkeypatch):
    def fail_provider(*_args, **_kwargs):
        raise RuntimeError("provider user_id=secret-provider-detail")

    monkeypatch.setattr("app.llm_service._execute_model_call", fail_provider)

    with pytest.raises(RuntimeError) as exc_info:
        call_model("cheap", "hello")

    assert "secret-provider-detail" not in str(exc_info.value)
    assert "RuntimeError" in str(exc_info.value)


def test_provider_call_uses_configured_timeout(monkeypatch):
    captured_kwargs = {}

    def complete(**kwargs):
        captured_kwargs.update(kwargs)
        return {"choices": [{"message": {"content": "ok"}}]}

    monkeypatch.setattr("app.llm_service.completion", complete)
    monkeypatch.setattr("app.llm_service.OPENROUTER_API_KEY", "test-provider-key")

    _execute_model_call("openrouter/openai/gpt-4o-mini", "hello")

    assert captured_kwargs["timeout"] == MODEL_REQUEST_TIMEOUT_SECONDS


def test_new_passwords_use_argon2id():
    password_hash = hash_password("RouteAlpha2026")

    assert password_hash.startswith("$argon2id$")
    assert verify_password("RouteAlpha2026", password_hash)
    assert not password_needs_rehash(password_hash)


def test_legacy_pbkdf2_passwords_remain_valid_for_transparent_upgrade():
    password = "RouteAlpha2026"
    salt = "legacy-test-salt"
    legacy_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000
    ).hex()

    assert verify_password(password, f"{salt}${legacy_hash}")
    assert password_needs_rehash(f"{salt}${legacy_hash}")


def test_access_tokens_are_purpose_bound_and_versioned():
    token = create_access_token("user-123", "user@example.com", token_version=4)

    payload = decode_access_token(token)

    assert payload["sub"] == "user-123"
    assert payload["email"] == "user@example.com"
    assert payload["ver"] == 4
    assert payload["jti"]
    assert payload["iat"] < payload["exp"]


def test_access_tokens_reject_unsigned_or_malformed_claims():
    with pytest.raises(ValueError):
        decode_access_token("eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.")


def test_logout_invalidates_existing_access_tokens(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    monkeypatch.setattr(main, "SessionLocal", test_session)

    session = test_session()
    try:
        user = User(
            user_id="logout-test-user",
            full_name="Logout Test",
            email="logout-test@example.com",
            password_hash=hash_password("RouteAlpha2026"),
            email_verified=True,
        )
        session.add(user)
        session.commit()
        token = create_access_token(user.user_id, user.email, user.token_version)
    finally:
        session.close()

    with TestClient(main.app, base_url="http://localhost") as client:
        headers = {"Authorization": f"Bearer {token}"}
        assert client.post("/auth/logout", headers=headers).status_code == 204
        assert client.get("/auth/me", headers=headers).status_code == 401


def test_email_verification_is_single_use_and_unlocks_login(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    monkeypatch.setattr(main, "SessionLocal", test_session)

    session = test_session()
    try:
        user = User(
            user_id="verify-test-user",
            full_name="Verify Test",
            email="verify-test@example.com",
            password_hash=hash_password("RouteAlpha2026"),
        )
        token = main._set_email_verification_token(user)
        stored_token_hash = user.email_verification_token_hash
        session.add(user)
        session.commit()
    finally:
        session.close()

    with TestClient(main.app, base_url="http://localhost") as client:
        assert client.post("/auth/verify-email", json={"token": token}).status_code == 200
        assert client.post("/auth/verify-email", json={"token": token}).status_code == 400
        response = client.post(
            "/auth/login",
            json={"email": "verify-test@example.com", "password": "RouteAlpha2026"},
        )
        assert response.status_code == 200

    session = test_session()
    try:
        verified_user = session.query(User).filter_by(user_id="verify-test-user").one()
        assert verified_user.email_verified is True
        assert verified_user.email_verification_token_hash is None
        assert stored_token_hash != token
    finally:
        session.close()


def test_registration_sends_hashed_single_use_verification_token(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    sent_messages = []
    monkeypatch.setattr(main, "SessionLocal", test_session)
    monkeypatch.setattr(
        main,
        "send_email_verification_safely",
        lambda **kwargs: sent_messages.append(kwargs),
    )

    with TestClient(main.app, base_url="http://localhost") as client:
        registration = client.post(
            "/auth/register",
            json={
                "full_name": "Registration Test",
                "email": "registration-test@example.com",
                "password": "RouteAlpha2026",
            },
        )
        assert registration.status_code == 200
        assert "verification email" in registration.json()["message"]
        login = client.post(
            "/auth/login",
            json={"email": "registration-test@example.com", "password": "RouteAlpha2026"},
        )
        assert login.status_code == 403

    assert sent_messages
    raw_token = sent_messages[0]["token"]
    session = test_session()
    try:
        user = session.query(User).filter_by(email="registration-test@example.com").one()
        assert user.email_verified is False
        assert user.email_verification_token_hash != raw_token
        assert user.email_verification_token_hash == main.hash_email_verification_token(raw_token)
    finally:
        session.close()


def test_two_factor_setup_enable_and_login_requirement(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    monkeypatch.setattr(main, "SessionLocal", test_session)

    session = test_session()
    try:
        user = User(
            user_id="totp-test-user",
            full_name="TOTP Test",
            email="totp-test@example.com",
            password_hash=hash_password("RouteAlpha2026"),
            email_verified=True,
        )
        session.add(user)
        session.commit()
        token = create_access_token(user.user_id, user.email, user.token_version)
    finally:
        session.close()

    with TestClient(main.app, base_url="http://localhost") as client:
        headers = {"Authorization": f"Bearer {token}"}
        setup = client.post("/auth/2fa/setup", headers=headers)
        assert setup.status_code == 200
        secret = setup.json()["secret"]

        enabled = client.post(
            "/auth/2fa/enable",
            headers=headers,
            json={"otp_code": pyotp.TOTP(secret).now()},
        )
        assert enabled.status_code == 200
        assert enabled.json()["two_factor_enabled"] is True
        recovery_code = enabled.json()["recovery_codes"][0]

        without_otp = client.post(
            "/auth/login",
            json={"email": "totp-test@example.com", "password": "RouteAlpha2026"},
        )
        assert without_otp.status_code == 401

        with_recovery_code = client.post(
            "/auth/login",
            json={
                "email": "totp-test@example.com",
                "password": "RouteAlpha2026",
                "otp_code": recovery_code,
            },
        )
        assert with_recovery_code.status_code == 200
        assert client.post(
            "/auth/login",
            json={
                "email": "totp-test@example.com",
                "password": "RouteAlpha2026",
                "otp_code": recovery_code,
            },
        ).status_code == 401

        with_otp = client.post(
            "/auth/login",
            json={
                "email": "totp-test@example.com",
                "password": "RouteAlpha2026",
                "otp_code": pyotp.TOTP(secret).now(),
            },
        )
        assert with_otp.status_code == 200

        disabled = client.post(
            "/auth/2fa/disable",
            headers=headers,
            json={"password": "RouteAlpha2026", "otp_code": pyotp.TOTP(secret).now()},
        )
        assert disabled.status_code == 200
        assert disabled.json()["two_factor_enabled"] is False
        assert client.post(
            "/auth/login",
            json={"email": "totp-test@example.com", "password": "RouteAlpha2026"},
        ).status_code == 200

def test_generic_rate_limit_returns_retry_after():
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/contact",
            "headers": [],
            "client": ("203.0.113.99", 12345),
            "scheme": "http",
            "server": ("testserver", 80),
        }
    )
    limit = parse("1/minute")

    enforce_rate_limit(request, limit, "test-rate-limit", "Rate limit exceeded.")
    with pytest.raises(HTTPException) as exc_info:
        enforce_rate_limit(request, limit, "test-rate-limit", "Rate limit exceeded.")

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers["Retry-After"]


def test_contact_request_returns_success_and_persists_before_notification(monkeypatch):
    """A slow notification provider must not be part of lead capture's transaction."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    notifications = []

    monkeypatch.setattr(main, "SessionLocal", test_session)
    monkeypatch.setattr(
        main,
        "send_contact_notification_safely",
        lambda **kwargs: notifications.append(kwargs),
    )

    with TestClient(main.app, base_url="http://localhost") as client:
        response = client.post(
            "/contact",
            json={
                "full_name": "Contact Test",
                "email": "contact-test@example.com",
                "use_case": "Verify durable lead capture.",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["email_sent"] is False
    assert notifications and notifications[0]["request_id"] == payload["request_id"]

    session = test_session()
    try:
        assert session.query(ContactRequest).filter_by(request_id=payload["request_id"]).one()
    finally:
        session.close()


def test_production_config_requires_the_supported_postgresql_driver_url():
    environment = os.environ.copy()
    environment.update(
        {
            "APP_ENV": "production",
            "AUTO_CREATE_SCHEMA": "false",
            "ENFORCE_HTTPS": "true",
            "DATABASE_URL": "postgresql://routealpha:password@db.example.com:5432/routealpha",
            "OPENROUTER_API_KEY": "production-test-key",
            "AUTH_SECRET_KEY": "production-test-auth-secret",
            "TOTP_ENCRYPTION_KEY": "vH_k7GA3cqTxTpRE0pBUmdCePGWSiXkS6Jv_DqmqmBo=",
            "METRICS_TOKEN": "production-test-metrics-token",
            "RATE_LIMIT_STORAGE_URI": "rediss://:password@redis.example.com:6379/0",
            "TELEMETRY_REDIS_URL": "rediss://:password@redis.example.com:6379/1",
            "CORS_ORIGINS": "https://app.example.com",
            "TRUSTED_HOSTS": "api.example.com",
            "FRONTEND_BASE_URL": "https://app.example.com",
            "RESEND_API_KEY": "re_test_provider_key",
            "EMAIL_SENDER": "RouteAlpha <hello@example.com>",
            "MODEL_CHEAP": "openrouter/google/gemini-3.5-flash-lite",
            "MODEL_MEDIUM": "openrouter/openai/gpt-4o-mini",
            "MODEL_STRONG": "openrouter/openai/gpt-4o",
            "MODEL_CHEAP_INPUT_PER_1K": "0.00030",
            "MODEL_CHEAP_OUTPUT_PER_1K": "0.00250",
            "MODEL_MEDIUM_INPUT_PER_1K": "0.00015",
            "MODEL_MEDIUM_OUTPUT_PER_1K": "0.00060",
            "MODEL_STRONG_INPUT_PER_1K": "0.00250",
            "MODEL_STRONG_OUTPUT_PER_1K": "0.01000",
        }
    )

    accepted = subprocess.run(
        [sys.executable, "-c", "import app.config"],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert accepted.returncode == 0, accepted.stderr

    environment["DATABASE_URL"] = (
        "postgresql+psycopg://routealpha:password@db.example.com:5432/routealpha"
    )
    rejected = subprocess.run(
        [sys.executable, "-c", "import app.config"],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert rejected.returncode != 0
    assert "DATABASE_URL must use PostgreSQL" in rejected.stderr
