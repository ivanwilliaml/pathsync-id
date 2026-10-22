"""learning loop: practice attempts

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-20 10:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('practice_attempts',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('student_id', sa.String(length=40), nullable=False),
    sa.Column('skill_id', sa.String(length=60), nullable=False),
    sa.Column('task_id', sa.String(length=40), nullable=False),
    sa.Column('tier', sa.String(length=12), nullable=False),
    sa.Column('correct', sa.Boolean(), nullable=False),
    sa.Column('answer', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('practice_attempts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_practice_attempts_student_id'), ['student_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_practice_attempts_skill_id'), ['skill_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('practice_attempts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_practice_attempts_skill_id'))
        batch_op.drop_index(batch_op.f('ix_practice_attempts_student_id'))
    op.drop_table('practice_attempts')
