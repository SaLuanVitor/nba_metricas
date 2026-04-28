import { Pool } from 'pg';

let pool: Pool | null = null;
let initialized = false;
let authInitialized = false;
let snapshotsInitialized = false;
let snapshotsInitPromise: Promise<boolean> | null = null;
let operationalInitialized = false;
let operationalInitPromise: Promise<boolean> | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function ensureAiLearningTable(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  if (initialized) return true;

  await p.query(`
    CREATE TABLE IF NOT EXISTS ai_specialist_learnings (
      id BIGSERIAL PRIMARY KEY,
      entity_type VARCHAR(16) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      source VARCHAR(32) NOT NULL,
      confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
      learning JSONB NOT NULL,
      learning_digest VARCHAR(64),
      tags TEXT[] NOT NULL DEFAULT '{}',
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`
    ALTER TABLE ai_specialist_learnings
    ADD COLUMN IF NOT EXISTS learning_digest VARCHAR(64);
  `);
  await p.query(`
    ALTER TABLE ai_specialist_learnings
    ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_specialist_learnings_entity
    ON ai_specialist_learnings (entity_type, entity_id, created_at DESC);
  `);

  initialized = true;
  return true;
}

export async function ensureAuthTables(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  if (authInitialized) return true;

  await p.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NULL,
      name VARCHAR(120) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'user',
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      provider VARCHAR(24) NOT NULL DEFAULT 'credentials',
      approved_at TIMESTAMPTZ NULL,
      approved_by VARCHAR(64) NULL,
      last_login_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS auth_approval_audit (
      id BIGSERIAL PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      action VARCHAR(16) NOT NULL,
      actor_id VARCHAR(64) NOT NULL,
      reason TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth_users (status);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users (role);
  `);
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_approval_audit_user ON auth_approval_audit (user_id, created_at DESC);
  `);

  authInitialized = true;
  return true;
}

export async function ensureDataSnapshotsTable(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  if (snapshotsInitialized) return true;
  if (snapshotsInitPromise) return snapshotsInitPromise;

  snapshotsInitPromise = (async () => {
    await p.query(`
      CREATE TABLE IF NOT EXISTS data_snapshots (
        id BIGSERIAL PRIMARY KEY,
        domain VARCHAR(64) NOT NULL,
        cache_key VARCHAR(255) NOT NULL,
        season VARCHAR(16) NULL,
        date_ref VARCHAR(16) NULL,
        payload_jsonb JSONB NOT NULL,
        source VARCHAR(32) NOT NULL DEFAULT 'none',
        source_health VARCHAR(16) NOT NULL DEFAULT 'degraded',
        cache_status VARCHAR(16) NOT NULL DEFAULT 'rejected',
        error_code VARCHAR(64) NULL,
        coverage NUMERIC(6,4) NULL,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        is_last_good BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    await p.query(`
      CREATE INDEX IF NOT EXISTS idx_data_snapshots_domain_cache_key
      ON data_snapshots (domain, cache_key);
    `);
    await p.query(`
      CREATE INDEX IF NOT EXISTS idx_data_snapshots_domain_expires_at
      ON data_snapshots (domain, expires_at DESC);
    `);
    await p.query(`
      CREATE INDEX IF NOT EXISTS idx_data_snapshots_captured_at
      ON data_snapshots (captured_at DESC);
    `);
    await p.query(`
      CREATE INDEX IF NOT EXISTS idx_data_snapshots_last_good
      ON data_snapshots (domain, cache_key, captured_at DESC)
      WHERE is_last_good = TRUE;
    `);

    snapshotsInitialized = true;
    return true;
  })();

  try {
    return await snapshotsInitPromise;
  } finally {
    snapshotsInitPromise = null;
  }
}

export async function ensureOperationalTables(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  if (operationalInitialized) return true;
  if (operationalInitPromise) return operationalInitPromise;

  operationalInitPromise = (async () => {
    await p.query(`
      CREATE TABLE IF NOT EXISTS sync_runs (
        id BIGSERIAL PRIMARY KEY,
        sync_type VARCHAR(32) NOT NULL,
        status VARCHAR(16) NOT NULL,
        output_jsonb JSONB NULL,
        error TEXT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ NULL
      );
    `);
    await p.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_runs_type_started
      ON sync_runs (sync_type, started_at DESC);
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS provider_runs (
        id BIGSERIAL PRIMARY KEY,
        provider VARCHAR(32) NOT NULL,
        endpoint VARCHAR(128) NOT NULL,
        status VARCHAR(16) NOT NULL,
        latency_ms INTEGER NULL,
        error_code VARCHAR(64) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await p.query(`
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
    `);
    await p.query(`
      CREATE INDEX IF NOT EXISTS idx_odds_snapshots_game_market
      ON odds_snapshots (game_id, market_type, captured_at DESC);
    `);

    await p.query(`
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
    `);
    await p.query(`
      CREATE INDEX IF NOT EXISTS idx_predictions_game_created
      ON predictions (game_id, created_at DESC);
    `);
    await p.query(`
      CREATE INDEX IF NOT EXISTS idx_predictions_player_created
      ON predictions (player_id, created_at DESC);
    `);

    await p.query(`
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
    `);

    await p.query(`
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
    `);

    operationalInitialized = true;
    return true;
  })();

  try {
    return await operationalInitPromise;
  } finally {
    operationalInitPromise = null;
  }
}

export async function startSyncRun(syncType: string): Promise<number | null> {
  if (!isPgConfigured()) return null;
  await ensureOperationalTables();
  const rows = await pgQuery<{ id: number }>(
    `INSERT INTO sync_runs (sync_type, status, started_at) VALUES ($1, 'started', NOW()) RETURNING id`,
    [syncType]
  );
  return rows[0]?.id ?? null;
}

export async function finishSyncRun(
  id: number | null,
  status: 'success' | 'failed',
  output?: unknown,
  error?: string
): Promise<void> {
  if (!id || !isPgConfigured()) return;
  await ensureOperationalTables();
  await pgQuery(
    `
      UPDATE sync_runs
      SET status=$2, output_jsonb=$3::jsonb, error=$4, finished_at=NOW()
      WHERE id=$1
    `,
    [id, status, JSON.stringify(output ?? null), error || null]
  );
}

export async function getLatestSyncRuns(limit = 10): Promise<Array<{
  id: number;
  syncType: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}>> {
  if (!isPgConfigured()) return [];
  await ensureOperationalTables();
  const rows = await pgQuery<{
    id: number;
    sync_type: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    error: string | null;
  }>(
    `
      SELECT id, sync_type, status, started_at, finished_at, error
      FROM sync_runs
      ORDER BY started_at DESC
      LIMIT $1
    `,
    [Math.max(1, Math.min(50, limit))]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    syncType: row.sync_type,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
  }));
}

export async function pgQuery<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  if (!p) return [];
  const result = await p.query(text, params);
  return result.rows as T[];
}

export function isPgConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function getPgHealth(): Promise<'configured' | 'degraded' | 'unavailable'> {
  if (!isPgConfigured()) return 'unavailable';
  try {
    const p = getPool();
    if (!p) return 'unavailable';
    await p.query('SELECT 1');
    return 'configured';
  } catch {
    return 'degraded';
  }
}
