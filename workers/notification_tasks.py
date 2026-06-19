import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from workers.celery_app import celery_app
from config import settings

def _send_email(to: str, subject: str, html: str) -> None:
    """Low-level SMTP helper. Raises on failure — Celery will catch and retry."""
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = settings.EMAIL_FROM
    msg['To'] = to
    msg.attach(MIMEText(html, 'html'))
    
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as srv:
        srv.starttls()
        srv.login(settings.SMTP_USER, settings.SMTP_PASS)
        srv.sendmail(settings.EMAIL_FROM, to, msg.as_string())

@celery_app.task(
    bind=True, 
    max_retries=3, 
    default_retry_delay=30,
    name='workers.notification_tasks.send_booking_confirmation'
)
def send_booking_confirmation(
    self, to_email: str, user_name: str, pnr: str,
    train_name: str, journey_date: str, status: str, total_amount: float
) -> None:
    """Fires after create_booking() — confirms the booking to the passenger."""
    try:
        color = '#065F46' if status == 'CONFIRMED' else '#92400E'
        html = f'''
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; margin: 20px;">
            <h2 style="color: {color};">Booking {status}</h2>
            <p>Dear {user_name},</p>
            <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">PNR</td><td style="padding: 8px;">{pnr}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">Train</td><td style="padding: 8px;">{train_name}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">Date</td><td style="padding: 8px;">{journey_date}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">Status</td><td style="padding: 8px; color: {color}; font-weight: bold;">{status}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">Amount</td><td style="padding: 8px;">Rs {total_amount}</td></tr>
            </table>
        </body>
        </html>
        '''
        _send_email(to_email, f'Booking {status} — PNR {pnr}', html)
    except Exception as exc:
        raise self.retry(exc=exc)

@celery_app.task(
    bind=True, 
    max_retries=3, 
    default_retry_delay=30,
    name='workers.notification_tasks.send_cancellation_confirmation'
)
def send_cancellation_confirmation(
    self, to_email: str, user_name: str, pnr: str, refund_amount: float
) -> None:
    """Fires after cancel_booking() — confirms cancellation and refund amount."""
    try: 
        html = f'''
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; margin: 20px;">
            <h2 style="color: #B91C1C;">Booking Cancelled</h2>
            <p>Dear {user_name}, your booking (PNR: {pnr}) has been successfully cancelled.</p>
            <p><strong>Refund Amount:</strong> Rs {refund_amount} — processed within 5–7 business days.</p>
        </body>
        </html>
        '''
        _send_email(to_email, f'Cancellation confirmed — PNR {pnr}', html)
    except Exception as exc:
        raise self.retry(exc=exc)

@celery_app.task(
    bind=True, 
    max_retries=3, 
    default_retry_delay=30,
    name='workers.notification_tasks.send_waitlist_promotion'
)
def send_waitlist_promotion(
    self, to_email: str, user_name: str, pnr: str, new_status: str
) -> None:
    """Fires from promotion_tasks when a WL/RAC passenger is promoted."""
    try:
        html = f'''
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; margin: 20px;">
            <h2 style="color: #2563EB;">Your booking status changed</h2>
            <p>Dear {user_name}, your booking PNR <strong>{pnr}</strong> has been successfully promoted to <strong>{new_status}</strong>.</p>
        </body>
        </html>
        '''
        _send_email(to_email, f'Your booking is now {new_status} — PNR {pnr}', html)
    except Exception as exc:
        raise self.retry(exc=exc)