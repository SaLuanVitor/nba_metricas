CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  sync_type VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL,
  output_jsonb JSONB NULL,
  error TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_type_started
ON sync_runs (sync_type, started_at DESC);

CREATE TABLE IF NOT EXISTS provider_runs (
  id BIGSERIAL PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  endpoint VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL,
  latency_ms INTEGER NULL,
  error_code VARCHAR(64) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_runs_provider_created
ON provider_runs (provider, created_at DESC);

CREATE TABLE IF NOT EXISTS odds_snapshots (
  id BIGSERIAL PRIMARY KEY,
  market_id VARCHAR(255) NOT NULL,
  game_id VARCHAR(64) NOT NULL,
  market_type VARCHAR(32) NOT NULL,
  side VARCHAR(16) NOT NULL,
  player_id VARCHAR(64) NULL,
  player_name VARCHAR(255) NULL,
  sportsbook VARCHAR(64) NOT NULL,
  line NUMERIC(8,2) NULL,
  american_odds INTEGER NULL,
  implied_prob NUMERIC(8,6) NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'boltodds',
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (market_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_odds_snapshots_game_market
ON odds_snapshots (game_id, market_type, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_odds_snapshots_player
ON odds_snapshots (player_id, game_id, captured_at DESC)
WHERE player_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS predictions (
  id VARCHAR(96) PRIMARY KEY,
  game_id VARCHAR(64) NOT NULL,
  player_id VARCHAR(64) NOT NULL,
  market VARCHAR(32) NOT NULL,
  side VARCHAR(16) NOT NULL,
  line NUMERIC(8,2) NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  probability NUMERIC(8,4) NOT NULL,
  confidence VARCHAR(24) NOT NULL,
  edge NUMERIC(8,4) NULL,
  expected_value NUMERIC(10,4) NULL,
  risk_level VARCHAR(16) NOT NULL,
  input_jsonb JSONB NOT NULL,
  output_jsonb JSONB NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'none',
  source_health VARCHAR(16) NOT NULL DEFAULT 'degraded',
  cache_status VARCHAR(16) NOT NULL DEFAULT 'rejected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  settlement_status VARCHAR(16) NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_predictions_game_created
ON predictions (game_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_player_created
ON predictions (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS prediction_outcomes (
  prediction_id VARCHAR(96) PRIMARY KEY REFERENCES predictions(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL,
  actual_value NUMERIC(8,2) NULL,
  settled_at TIMESTAMPTZ NULL,
  roi_units NUMERIC(10,4) NULL,
  error_abs NUMERIC(10,4) NULL,
  brier_score NUMERIC(10,6) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_runs (
  id VARCHAR(96) PRIMARY KEY,
  model_version VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  methodology TEXT NOT NULL,
  training_window TEXT NOT NULL,
  validation_window TEXT NOT NULL,
  metrics_jsonb JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
