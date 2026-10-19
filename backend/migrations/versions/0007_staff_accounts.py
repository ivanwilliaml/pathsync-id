"""staff accounts: email + password sign-in on top of the staff tokens

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-19 18:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('staff_accounts',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('email', sa.String(length=200), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('subject_id', sa.String(length=40), nullable=False),
    sa.Column('password_hash', sa.String(length=200), nullable=True),
    sa.Column('invite_hash', sa.String(length=64), nullable=True),
    sa.Column('invite_expires_at', sa.DateTime(), nullable=True),
    sa.Column('token_id', sa.Integer(), nullable=True),
    sa.Column('demo', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('last_login_at', sa.DateTime(), nullable=True),
    sa.Column('disabled_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['token_id'], ['api_tokens.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('staff_accounts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_staff_accounts_email'), ['email'], unique=True)
        batch_op.create_index(batch_op.f('ix_staff_accounts_invite_hash'), ['invite_hash'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('staff_accounts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_staff_accounts_invite_hash'))
        batch_op.drop_index(batch_op.f('ix_staff_accounts_email'))
    op.drop_table('staff_accounts')
