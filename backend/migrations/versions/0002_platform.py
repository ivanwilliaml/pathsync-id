"""Platform: auth tokens, assessment sessions, classroom, cohorts, studies

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('api_tokens',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('subject_id', sa.String(length=40), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('label', sa.String(length=120), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('revoked_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_api_tokens_role'), 'api_tokens', ['role'], unique=False)
    op.create_table('app_state',
    sa.Column('key', sa.String(length=60), nullable=False),
    sa.Column('value', sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint('key')
    )
    op.create_table('cohorts',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('institution', sa.String(length=200), nullable=False),
    sa.Column('join_code', sa.String(length=12), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('join_code')
    )
    op.create_table('studies',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('join_code', sa.String(length=12), nullable=False),
    sa.Column('arms', sa.JSON(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('join_code')
    )
    op.create_table('assessment_sessions',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('student_id', sa.String(length=40), nullable=False),
    sa.Column('phase', sa.String(length=20), nullable=False),
    sa.Column('skill_id', sa.String(length=60), nullable=True),
    sa.Column('item_ids', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('submitted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assessment_sessions_student_id'), 'assessment_sessions', ['student_id'], unique=False)
    op.create_table('course_enrollments',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('student_id', sa.String(length=40), nullable=False),
    sa.Column('course_name', sa.String(length=200), nullable=False),
    sa.Column('term', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=12), nullable=False),
    sa.Column('mapping', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_course_enrollments_student_id'), 'course_enrollments', ['student_id'], unique=False)
    op.create_table('pulses',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('student_id', sa.String(length=40), nullable=False),
    sa.Column('item', sa.String(length=40), nullable=False),
    sa.Column('value', sa.Integer(), nullable=False),
    sa.Column('context', sa.String(length=40), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pulses_student_id'), 'pulses', ['student_id'], unique=False)
    op.create_table('study_plans',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('student_id', sa.String(length=40), nullable=False),
    sa.Column('study_id', sa.String(length=40), nullable=False),
    sa.Column('plan_text', sa.Text(), nullable=False),
    sa.Column('started_at', sa.DateTime(), nullable=False),
    sa.Column('submitted_at', sa.DateTime(), nullable=False),
    sa.Column('blind_code', sa.String(length=12), nullable=False),
    sa.Column('ratings', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.ForeignKeyConstraint(['study_id'], ['studies.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('blind_code')
    )
    op.create_index(op.f('ix_study_plans_student_id'), 'study_plans', ['student_id'], unique=False)
    op.create_index(op.f('ix_study_plans_study_id'), 'study_plans', ['study_id'], unique=False)
    op.create_table('weekly_plans',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('student_id', sa.String(length=40), nullable=False),
    sa.Column('week_start', sa.Date(), nullable=False),
    sa.Column('goals', sa.JSON(), nullable=False),
    sa.Column('planned_minutes', sa.Integer(), nullable=False),
    sa.Column('reflection', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('reflected_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_weekly_plans_student_id'), 'weekly_plans', ['student_id'], unique=False)
    op.create_index(op.f('ix_weekly_plans_week_start'), 'weekly_plans', ['week_start'], unique=False)
    with op.batch_alter_table('evidence') as b:
        b.add_column(sa.Column('review_status', sa.String(length=12), nullable=False, server_default='auto'))
        b.create_index('ix_evidence_review_status', ['review_status'], unique=False)
    with op.batch_alter_table('students') as b:
        b.add_column(sa.Column('token_hash', sa.String(length=64), nullable=True))
        b.add_column(sa.Column('semester', sa.Integer(), nullable=True))
        b.add_column(sa.Column('consent_version', sa.String(length=20), nullable=False, server_default=''))
        b.add_column(sa.Column('cohort_id', sa.String(length=40), nullable=True))
        b.add_column(sa.Column('study_id', sa.String(length=40), nullable=True))
        b.add_column(sa.Column('study_arm', sa.String(length=20), nullable=True))
        b.create_index('ix_students_cohort_id', ['cohort_id'], unique=False)
        b.create_index('ix_students_study_id', ['study_id'], unique=False)
        b.create_index('ix_students_token_hash', ['token_hash'], unique=False)
        b.create_foreign_key('fk_students_study_id', 'studies', ['study_id'], ['id'])
        b.create_foreign_key('fk_students_cohort_id', 'cohorts', ['cohort_id'], ['id'])

def downgrade() -> None:
    with op.batch_alter_table('students') as b:
        b.drop_constraint('fk_students_cohort_id', type_='foreignkey')
        b.drop_constraint('fk_students_study_id', type_='foreignkey')
        b.drop_index('ix_students_token_hash')
        b.drop_index('ix_students_study_id')
        b.drop_index('ix_students_cohort_id')
        for c in ('study_arm', 'study_id', 'cohort_id', 'consent_version', 'semester', 'token_hash'):
            b.drop_column(c)
    with op.batch_alter_table('evidence') as b:
        b.drop_index('ix_evidence_review_status')
        b.drop_column('review_status')
    op.drop_index(op.f('ix_weekly_plans_week_start'), table_name='weekly_plans')
    op.drop_index(op.f('ix_weekly_plans_student_id'), table_name='weekly_plans')
    op.drop_table('weekly_plans')
    op.drop_index(op.f('ix_study_plans_study_id'), table_name='study_plans')
    op.drop_index(op.f('ix_study_plans_student_id'), table_name='study_plans')
    op.drop_table('study_plans')
    op.drop_index(op.f('ix_pulses_student_id'), table_name='pulses')
    op.drop_table('pulses')
    op.drop_index(op.f('ix_course_enrollments_student_id'), table_name='course_enrollments')
    op.drop_table('course_enrollments')
    op.drop_index(op.f('ix_assessment_sessions_student_id'), table_name='assessment_sessions')
    op.drop_table('assessment_sessions')
    op.drop_table('studies')
    op.drop_table('cohorts')
    op.drop_table('app_state')
    op.drop_index(op.f('ix_api_tokens_role'), table_name='api_tokens')
    op.drop_table('api_tokens')
