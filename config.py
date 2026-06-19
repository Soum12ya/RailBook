from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """
    All configuration is read from environment variables or the .env file.
    Never hardcode secrets in source code — they end up in git history forever.
    """

    DATABASE_URL : str = "postgresql://postgres:postgres123@127.0.0.1:5432/train_booking"
    SECRET_KEY : str = "36223064ac5cd7afd23fffadfa775e9a2f7f9b4820940bbad9eb42a48f2e955b"
    ALGORITHM : str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES : str = 60

    # Redis
    REDIS_URL: str = 'redis://127.0.0.1:6379/0'
    CACHE_TTL_SECONDS: int = 300

    # RabbitMQ / Celery
    RABBITMQ_URL: str = 'amqp://guest:guest@127.0.0.1:5672/'
    CELERY_RESULT_BACKEND: str = 'redis://127.0.0.1:6379/1'

    # Elasticsearch
    ELASTICSEARCH_URL: str = 'http://127.0.0.1:9200'
    ES_TRAINS_INDEX: str = 'trains'
    ES_STATIONS_INDEX: str = 'stations'

    # Email
    SMTP_HOST: str = 'sandbox.smtp.mailtrap.io'
    SMTP_PORT: int = 587
    SMTP_USER: str = ''
    SMTP_PASS: str = ''
    EMAIL_FROM: str = 'noreply@trainbooking.com'

    class Config:
        env_file = ".env"

settings = Settings()        
