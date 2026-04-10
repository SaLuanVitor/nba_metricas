import { Pool } from 'pg';

let pool: Pool | null = null;
let initialized = false;
let authInitialized = false;

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
