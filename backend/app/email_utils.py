from email.message import EmailMessage
import smtplib

from app.config import (
    CONTACT_NOTIFICATION_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_SENDER_EMAIL,
    SMTP_USERNAME,
)
from app.schemas import ContactRequestCreate


def send_contact_notification(
    request_id: str, request: ContactRequestCreate
) -> tuple[bool, str]:
    if (
        not SMTP_USERNAME
        or not SMTP_PASSWORD
        or not SMTP_SENDER_EMAIL
        or not CONTACT_NOTIFICATION_EMAIL
    ):
        return False, (
            "SMTP is not configured. Set SMTP_USERNAME, SMTP_PASSWORD, "
            "SMTP_SENDER_EMAIL, and CONTACT_NOTIFICATION_EMAIL to enable "
            "contact notifications."
        )

    message = EmailMessage()
    message["Subject"] = f"RouteAlpha contact request from {request.full_name}"
    message["From"] = SMTP_SENDER_EMAIL
    message["To"] = CONTACT_NOTIFICATION_EMAIL
    message["Reply-To"] = request.email
    message.set_content(
        "\n".join(
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
        )
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)

    return True, "Notification email sent."
