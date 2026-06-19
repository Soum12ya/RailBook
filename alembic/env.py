"""
alembic/env.py — Alembic migration environment.

This file tells Alembic:
  1. Where to find the database (reads from config or .env)
  2. Which models to inspect when autogenerating migrations
  3. How to run migrations (online = against live DB, offline = SQL only)

WHY Alembic instead of create_all():
  Base.metadata.create_all(engine) creates tables that don't exist
  but IGNORES tables that do exist — it never alters them.
  So if you add a column to a model, create_all() silently skips it.

  Alembic generates ALTER TABLE statements:
    alembic revision --autogenerate -m "add idempotency_key"
    → inspects your models vs the real database
    → generates: ALTER TABLE bookings ADD COLUMN idempotency_key VARCHAR;

  Then: alembic upgrade head → runs that SQL against your database.
  Your data is preserved. Only the new column is added.
"""

import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Import your app's Base and ALL models so Alembic can see them
from database import Base
import models  # noqa: F401 — registers all models with Base.metadata

config = context.config

# Use DATABASE_URL from environment if available (overrides alembic.ini)
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# This is the MetaData object that Alembic compares against the live DB
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generate SQL script only."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connect and apply immediately."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()