"""market snapshot provenance (plan B5)

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-14 20:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('market_snapshots', schema=None) as batch_op:
        batch_op.add_column(sa.Column('provenance', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('market_snapshots', schema=None) as batch_op:
        batch_op.drop_column('provenance')
