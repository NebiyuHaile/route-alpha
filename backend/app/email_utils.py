"""Transactional email delivery through HTTPS, compatible with Render's free plan."""

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import (
    CONTACT_NOTIFICATION_EMAIL,
    EMAIL_VERIFICATION_TOKEN_TTL_HOURS,
    EMAIL_SENDER,
    FRONTEND_BASE_URL,
    RESEND_API_KEY,
)
from app.schemas import ContactRequestCreate


def _send_transactional_email(recipient: str, subject: str, text: str) -> None:
    """Send a plain-text message through Resend's HTTPS API."""
    if not RESEND_API_KEY or not EMAIL_SENDER:
        raise RuntimeError("Resend is not configured for transactional email.")

    payload = json.dumps(
        {"from": EMAIL_SENDER, "to": [recipient], "subject": subject, "text": text}
    ).encode("utf-8")
    request = Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=20) as response:
            if not 200 <= response.status < 300:
                raise RuntimeError("Transactional email provider rejected the message.")
    except (HTTPError, URLError) as exc:
        raise RuntimeError("Transactional email delivery failed.") from exc


def send_contact_notification(
    request_id: str, request: ContactRequestCreate
) -> tuple[bool, str]:
    if not CONTACT_NOTIFICATION_EMAIL:
        return False, "CONTACT_NOTIFICATION_EMAIL is not configured."

    _send_transactional_email(
        recipient=CONTACT_NOTIFICATION_EMAIL,
        subject=f"RouteAlpha contact request from {request.full_name}",
        text="\n".join(
            [
                "New RouteAlpha contact request",
                "",
                f"Request ID: {request_id}",
                f"Name: {request.full_name}",
                f"Email: {request.email}",
                f"Company: {request.company or '-'}",
                f"Team size: {request.team_size or '-'}",
                "",
                "Use case:",
                request.use_case,
                "",
                "Message:",
                request.message or "-",
            ]
        ),
    )
    return True, "Notification email sent."


def send_contact_notification_safely(
    request_id: str, request: ContactRequestCreate
) -> None:
    """Deliver after persistence without making lead capture fail if email is down."""
    try:
        send_contact_notification(request_id=request_id, request=request)
    except Exception:
        return


def send_email_verification(email: str, full_name: str, token: str) -> None:
    """Send a verification link without persisting or logging the raw token."""
    # URL fragments are never sent in the frontend HTTP request, avoiding token
    # exposure in platform access logs and referrer headers.
    verification_url = f"{FRONTEND_BASE_URL}/verify-email#token={token}"
    _send_transactional_email(
        recipient=email,
        subject="Verify your RouteAlpha account",
        text="\n".join(
            [
                f"Hi {full_name},",
                "",
                "Verify your RouteAlpha account by opening this link:",
                verification_url,
                "",
                f"This link expires in {EMAIL_VERIFICATION_TOKEN_TTL_HOURS} hours. "
                "If you did not create this account, you can ignore this email.",
            ]
        ),
    )


def send_email_verification_safely(email: str, full_name: str, token: str) -> None:
    try:
        send_email_verification(email=email, full_name=full_name, token=token)
    except Exception:
        # The account remains unverified, and the user can request another link.
        return
