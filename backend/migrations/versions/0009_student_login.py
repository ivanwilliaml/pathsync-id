"""students sign in with email + password

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-22 19:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('students', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email', sa.String(length=254), nullable=True))
        batch_op.add_column(sa.Column('password_hash', sa.String(length=200), nullable=True))
        batch_op.create_index(batch_op.f('ix_students_email'), ['email'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('students', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_students_email'))
        batch_op.drop_column('password_hash')
        batch_op.drop_column('email')
