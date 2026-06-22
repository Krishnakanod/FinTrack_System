"""Email utility for sending OTP and notification emails via Gmail SMTP."""

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from core.config import settings


async def send_email(
    to_email: str,
    subject: str,
    body_html: str,
) -> bool:
    """
    Send an HTML email via Gmail SMTP.

    Uses aiosmtplib for async-safe sending in FastAPI context.

    Args:
        to_email: Recipient email address
        subject: Email subject line
        body_html: HTML body content

    Returns:
        True if sent successfully, raises exception on failure
    """
    # Create message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.gmail_user
    msg["To"] = to_email

    # Attach HTML body
    html_part = MIMEText(body_html, "html", "utf-8")
    msg.attach(html_part)

    # Configure SMTP connection
    smtp_settings = {
        "hostname": "smtp.gmail.com",
        "port": 587,
        "username": settings.gmail_user,
        "password": settings.gmail_app_password,
        "use_tls": True,
    }

    try:
        await aiosmtplib.send(msg, **smtp_settings)
        return True
    except Exception as e:
        raise RuntimeError(f"Failed to send email to {to_email}: {str(e)}")


def create_otp_email_body(otp: str, purpose: str) -> tuple[str, str]:
    """
    Create the HTML and plain-text body for an OTP email.

    Args:
        otp: The 6-digit OTP code
        purpose: Either "signup", "login", or "forgot_password"

    Returns:
        Tuple of (subject, html_body)
    """
    # Determine subject based on purpose
    subjects = {
        "signup": "Verify your FinTrack account",
        "login": "Your FinTrack login verification code",
        "forgot_password": "Your FinTrack password reset code",
    }
    subject = subjects.get(purpose, "Your FinTrack verification code")

    # Capitalize purpose for display
    purpose_display = purpose.replace("_", " ").title()

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }}
            .header {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 28px;
            }}
            .body {{
                padding: 40px 30px;
            }}
            .otp-box {{
                background-color: #f8f9fa;
                border: 2px dashed #667eea;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
            }}
            .otp-code {{
                font-size: 36px;
                font-weight: bold;
                color: #667eea;
                letter-spacing: 4px;
                margin: 10px 0;
            }}
            .message {{
                color: #555;
                line-height: 1.6;
                font-size: 16px;
            }}
            .footer {{
                background-color: #f8f9fa;
                padding: 20px;
                text-align: center;
                color: #888;
                font-size: 12px;
            }}
            .warning {{
                color: #dc3545;
                font-size: 14px;
                margin-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>FinTrack</h1>
            </div>
            <div class="body">
                <p class="message">Hello,</p>
                <p class="message">
                    You have requested a {purpose_display} verification code for your FinTrack account.
                    Please use the following code to complete the process:
                </p>
                <div class="otp-box">
                    <div>Your Verification Code</div>
                    <div class="otp-code">{otp}</div>
                </div>
                <p class="message">This code will expire in <strong>10 minutes</strong>.</p>
                <p class="warning">
                    ⚠️ Do not share this code with anyone. FinTrack staff will never ask for your OTP.
                </p>
                <p class="message" style="margin-top: 30px;">
                    If you didn't request this code, you can safely ignore this email.
                </p>
            </div>
            <div class="footer">
                <p>&copy; 2026 FinTrack. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    return subject, html_body
