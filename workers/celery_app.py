from celery import Celery
from config import settings

celery_app = Celery(
    'train_booking',
    broker=settings.RABBITMQ_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        'workers.notification_tasks',
        'workers.promotion_tasks',
    ],
)

celery_app.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='Asia/Kolkata',
    enable_utc=True,
    
    # Reliability: Retry lost tasks if a worker dies mid-execution
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=30,  # seconds between retries
    task_max_retries=3,
    
    # Scaling: Separate named queues so notification and promotion workers can scale independently
    task_routes={
        'workers.notification_tasks.*': {'queue': 'notifications'},
        'workers.promotion_tasks.*': {'queue': 'promotions'},
    },
)