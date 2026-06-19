"""Add idempotency_key and refund_amount to bookings

Revision ID: 001
Create Date: 2025-01-01 00:00:00

WHY: Level 2 adds two new columns to the bookings table:
  - idempotency_key: prevents duplicate bookings on network retries
  - refund_amount:   stores the calculated refund on cancellation

HOW to run:
  alembic upgrade head    ← applies this migration to the database
  alembic downgrade -1    ← rolls it back if needed
"""

from alembic import op
import sqlalchemy as sa

# Alembic requires these — used to chain migrations together
revision = "001"
down_revision = None   # first migration, no parent
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Apply the migration — add the two new columns.

    op.add_column() generates:
      ALTER TABLE bookings ADD COLUMN idempotency_key VARCHAR;
      ALTER TABLE bookings ADD COLUMN refund_amount FLOAT;

    CREATE INDEX ix_bookings_idempotency_key ON bookings (idempotency_key);
    CREATE UNIQUE INDEX uq_bookings_idempotency_key ON bookings (idempotency_key);

    Existing rows get NULL for both columns — that's fine because
    both are nullable and have defaults.
    """
    op.add_column(
        "bookings",
        sa.Column("idempotency_key", sa.String(), nullable=True),
    )
    op.add_column(
        "bookings",
        sa.Column("refund_amount", sa.Float(), nullable=True),
    )
    # Add unique constraint so two bookings can't share the same key
    op.create_index(
        "ix_bookings_idempotency_key",
        "bookings",
        ["idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    """
    Roll back the migration — remove the columns.

    Used if you need to go back to Level 1 schema.
    alembic downgrade -1 runs this.
    """
    op.drop_index("ix_bookings_idempotency_key", table_name="bookings")
    op.drop_column("bookings", "refund_amount")
    op.drop_column("bookings", "idempotency_key")