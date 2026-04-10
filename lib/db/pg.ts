import { Pool } from 'pg';

let pool: Pool | null = null;
let initialized = false;

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
