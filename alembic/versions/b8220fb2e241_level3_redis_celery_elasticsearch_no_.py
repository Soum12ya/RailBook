"""level3_redis_celery_elasticsearch_no_schema_changes

Revision ID: b8220fb2e241
Revises: 84a24304517d
Create Date: 2026-06-18 02:55:59.524277

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8220fb2e241'
down_revision: Union[str, None] = '84a24304517d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
