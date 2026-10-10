"""Baseline schema (MVP, before migrations)

Revision ID: 0001
Revises: None
"""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('experts',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('affiliation', sa.String(length=200), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('validates_graph', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('graph_edges',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('src', sa.String(length=60), nullable=False),
    sa.Column('dst', sa.String(length=60), nullable=False),
    sa.Column('source', sa.String(length=12), nullable=False),
    sa.Column('rationale', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=12), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('market_snapshots',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('version', sa.String(length=40), nullable=False),
    sa.Column('role', sa.String(length=40), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('reference_date', sa.Date(), nullable=False),
    sa.Column('data', sa.JSON(), nullable=False),
    sa.Column('required', sa.JSON(), nullable=False),
    sa.Column('sources', sa.JSON(), nullable=False),
    sa.Column('note', sa.Text(), nullable=False),
    sa.Column('simulated', sa.Boolean(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_market_snapshots_role'), 'market_snapshots', ['role'], unique=False)
    op.create_index(op.f('ix_market_snapshots_version'), 'market_snapshots', ['version'], unique=False)
    op.create_table('postings',
    sa.Column('id', sa.String(length=160), nullable=False),
    sa.Column('source', sa.String(length=32), nullable=False),
    sa.Column('url', sa.Text(), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('company', sa.String(length=300), nullable=False),
    sa.Column('location', sa.String(length=300), nullable=False),
    sa.Column('published_at', sa.Date(), nullable=True),
    sa.Column('fetched_at', sa.DateTime(), nullable=False),
    sa.Column('first_seen', sa.Date(), nullable=False),
    sa.Column('role', sa.String(length=40), nullable=False),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('fingerprint', sa.String(length=64), nullable=False),
    sa.Column('duplicate_of', sa.String(length=160), nullable=True),
    sa.Column('in_window', sa.Boolean(), nullable=False),
    sa.Column('extractor', sa.String(length=20), nullable=False),
    sa.Column('meta', sa.JSON(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_postings_fingerprint'), 'postings', ['fingerprint'], unique=False)
    op.create_index(op.f('ix_postings_published_at'), 'postings', ['published_at'], unique=False)
    op.create_index(op.f('ix_postings_role'), 'postings', ['role'], unique=False)
    op.create_index(op.f('ix_postings_source'), 'postings', ['source'], unique=False)
    op.create_table('ranker_models',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('weights', sa.JSON(), nullable=False),
    sa.Column('metrics', sa.JSON(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('scenarios',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('base_id', sa.String(length=40), nullable=False),
    sa.Column('variant', sa.String(length=20), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('role', sa.String(length=40), nullable=False),
    sa.Column('payload', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scenarios_base_id'), 'scenarios', ['base_id'], unique=False)
    op.create_table('students',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('display_name', sa.String(length=120), nullable=False),
    sa.Column('program', sa.String(length=120), nullable=False),
    sa.Column('target_role', sa.String(length=40), nullable=False),
    sa.Column('consent_at', sa.DateTime(), nullable=True),
    sa.Column('preferences', sa.JSON(), nullable=False),
    sa.Column('self_ratings', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('annotations',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('posting_id', sa.String(length=160), nullable=False),
    sa.Column('annotator', sa.String(length=80), nullable=False),
    sa.Column('skill_ids', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['posting_id'], ['postings.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_annotations_posting_id'), 'annotations', ['posting_id'], unique=False)
    op.create_table('assessment_responses',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('student_id', sa.String(length=40), nullable=False),
    sa.Column('item_id', sa.String(length=40), nullable=False),
    sa.Column('skill_id', sa.String(length=60), nullable=False),
    sa.Column('correct', sa.Boolean(), nullable=False),
    sa.Column('phase', sa.String(length=20), nullable=False),
    sa.Column('session_id', sa.String(length=40), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assessment_responses_skill_id'), 'assessment_responses', ['skill_id'], unique=False)
    op.create_index(op.f('ix_assessment_responses_student_id'), 'assessment_responses', ['student_id'], unique=False)
    op.create_table('edge_votes',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('edge_id', sa.Integer(), nullable=False),
    sa.Column('expert_id', sa.String(length=40), nullable=False),
    sa.Column('approve', sa.Boolean(), nullable=False),
    sa.Column('comment', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['edge_id'], ['graph_edges.id'], ),
    sa.ForeignKeyConstraint(['expert_id'], ['experts.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_edge_votes_edge_id'), 'edge_votes', ['edge_id'], unique=False)
    op.create_index(op.f('ix_edge_votes_expert_id'), 'edge_votes', ['expert_id'], unique=False)
    op.create_table('evidence',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('student_id', sa.String(length=40), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('scores', sa.JSON(), nullable=False),
    sa.Column('details', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_evidence_student_id'), 'evidence', ['student_id'], unique=False)
    op.create_table('posting_mentions',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('posting_id', sa.String(length=160), nullable=False),
    sa.Column('skill_id', sa.String(length=60), nullable=True),
    sa.Column('surface', sa.String(length=300), nullable=False),
    sa.Column('quote', sa.Text(), nullable=False),
    sa.Column('level', sa.String(length=10), nullable=False),
    sa.Column('similarity', sa.Float(), nullable=False),
    sa.Column('status', sa.String(length=12), nullable=False),
    sa.Column('method', sa.String(length=12), nullable=False),
    sa.Column('review_decision', sa.String(length=60), nullable=True),
    sa.ForeignKeyConstraint(['posting_id'], ['postings.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_posting_mentions_posting_id'), 'posting_mentions', ['posting_id'], unique=False)
    op.create_index(op.f('ix_posting_mentions_skill_id'), 'posting_mentions', ['skill_id'], unique=False)
    op.create_index(op.f('ix_posting_mentions_status'), 'posting_mentions', ['status'], unique=False)
    op.create_table('recommendation_history',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('student_id', sa.String(length=40), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('trigger', sa.String(length=20), nullable=False),
    sa.Column('summary', sa.Text(), nullable=False),
    sa.Column('reasons', sa.JSON(), nullable=False),
    sa.Column('ranking', sa.JSON(), nullable=False),
    sa.Column('path', sa.JSON(), nullable=False),
    sa.Column('coverage', sa.Float(), nullable=False),
    sa.Column('market_version', sa.String(length=40), nullable=False),
    sa.Column('model_name', sa.String(length=80), nullable=False),
    sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_recommendation_history_student_id'), 'recommendation_history', ['student_id'], unique=False)
    op.create_table('scenario_rankings',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('scenario_id', sa.String(length=40), nullable=False),
    sa.Column('expert_id', sa.String(length=40), nullable=False),
    sa.Column('order', sa.JSON(), nullable=False),
    sa.Column('simulated', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['expert_id'], ['experts.id'], ),
    sa.ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scenario_rankings_expert_id'), 'scenario_rankings', ['expert_id'], unique=False)
    op.create_index(op.f('ix_scenario_rankings_scenario_id'), 'scenario_rankings', ['scenario_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_scenario_rankings_scenario_id'), table_name='scenario_rankings')
    op.drop_index(op.f('ix_scenario_rankings_expert_id'), table_name='scenario_rankings')
    op.drop_table('scenario_rankings')
    op.drop_index(op.f('ix_recommendation_history_student_id'), table_name='recommendation_history')
    op.drop_table('recommendation_history')
    op.drop_index(op.f('ix_posting_mentions_status'), table_name='posting_mentions')
    op.drop_index(op.f('ix_posting_mentions_skill_id'), table_name='posting_mentions')
    op.drop_index(op.f('ix_posting_mentions_posting_id'), table_name='posting_mentions')
    op.drop_table('posting_mentions')
    op.drop_index(op.f('ix_evidence_student_id'), table_name='evidence')
    op.drop_table('evidence')
    op.drop_index(op.f('ix_edge_votes_expert_id'), table_name='edge_votes')
    op.drop_index(op.f('ix_edge_votes_edge_id'), table_name='edge_votes')
    op.drop_table('edge_votes')
    op.drop_index(op.f('ix_assessment_responses_student_id'), table_name='assessment_responses')
    op.drop_index(op.f('ix_assessment_responses_skill_id'), table_name='assessment_responses')
    op.drop_table('assessment_responses')
    op.drop_index(op.f('ix_annotations_posting_id'), table_name='annotations')
    op.drop_table('annotations')
    op.drop_table('students')
    op.drop_index(op.f('ix_scenarios_base_id'), table_name='scenarios')
    op.drop_table('scenarios')
    op.drop_table('ranker_models')
    op.drop_index(op.f('ix_postings_source'), table_name='postings')
    op.drop_index(op.f('ix_postings_role'), table_name='postings')
    op.drop_index(op.f('ix_postings_published_at'), table_name='postings')
    op.drop_index(op.f('ix_postings_fingerprint'), table_name='postings')
    op.drop_table('postings')
    op.drop_index(op.f('ix_market_snapshots_version'), table_name='market_snapshots')
    op.drop_index(op.f('ix_market_snapshots_role'), table_name='market_snapshots')
    op.drop_table('market_snapshots')
    op.drop_table('graph_edges')
    op.drop_table('experts')
