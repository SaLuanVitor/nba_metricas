import { ensureDataSnapshotsTable, isPgConfigured, pgQuery } from '@/lib/db/pg';

export type SnapshotDomain = 'players' | 'teams' | 'games' | 'boxscore' | 'player' | 'player-stats' | 'team-roster' | 'generic';
export type SnapshotCacheStatus = 'fresh' | 'stale' | 'rejected';
export type SnapshotSourceHealth = 'ok' | 'degraded';

type SnapshotRow = {
  id: number;
  domain: string;
  cache_key: string;
  season: string | null;
  date_ref: string | null;
  payload_jsonb: any;
  source: string;
  source_health: SnapshotSourceHealth;
  cache_status: SnapshotCacheStatus;
  error_code: string | null;
  coverage: number | null;
  captured_at: string;
  expires_at: string;
  is_last_good: boolean;
};

export type SavedSnapshotInput = {
  domain: SnapshotDomain;
  cacheKey: string;
  payload: unknown;
  ttlMs: number;
  source: string;
  sourceHealth: SnapshotSourceHealth;
  cacheStatus: SnapshotCacheStatus;
  errorCode?: string;
  coverage?: number;
  season?: string;
  dateRef?: string;
  isGood?: boolean;
};

export type SnapshotLookup =
  | { status: 'none' }
  | {
      status: 'fresh' | 'last_good';
      snapshot: {
        payload: any;
        source: string;
        sourceHealth: SnapshotSourceHealth;
        cacheStatus: SnapshotCacheStatus;
        errorCode?: string;
        coverage?: number;
        capturedAt: string;
        expiresAt: string;
      };
    };

function nowIso() {
  return new Date().toISOString();
}

export async function getFreshOrLastGood(domain: SnapshotDomain, cacheKey: string): Promise<SnapshotLookup> {
  if (!isPgConfigured()) return { status: 'none' };
  await ensureDataSnapshotsTable();

  const fresh = await pgQuery<SnapshotRow>(
    `
      SELECT *
      FROM data_snapshots
      WHERE domain = $1 AND cache_key = $2 AND expires_at > NOW()
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    [domain, cacheKey]
  );
  if (fresh[0]) {
    const row = fresh[0];
    return {
      status: 'fresh',
      snapshot: {
        payload: row.payload_jsonb,
        source: row.source,
        sourceHealth: row.source_health,
        cacheStatus: row.cache_status,
        errorCode: row.error_code || undefined,
        coverage: row.coverage ?? undefined,
        capturedAt: row.captured_at,
        expiresAt: row.expires_at,
      },
    };
  }

  const lastGood = await pgQuery<SnapshotRow>(
    `
      SELECT *
      FROM data_snapshots
      WHERE domain = $1 AND cache_key = $2 AND is_last_good = TRUE
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    [domain, cacheKey]
  );
  if (!lastGood[0]) return { status: 'none' };
  const row = lastGood[0];
  return {
    status: 'last_good',
    snapshot: {
      payload: row.payload_jsonb,
      source: row.source,
      sourceHealth: row.source_health,
      cacheStatus: row.cache_status,
      errorCode: row.error_code || undefined,
      coverage: row.coverage ?? undefined,
      capturedAt: row.captured_at,
      expiresAt: row.expires_at,
    },
  };
}

export async function saveSnapshot(input: SavedSnapshotInput): Promise<{ capturedAt: string } | null> {
  if (!isPgConfigured()) return null;
  await ensureDataSnapshotsTable();

  const capturedAt = nowIso();
  const expiresAt = new Date(Date.now() + Math.max(1_000, input.ttlMs)).toISOString();
  const isGood = Boolean(
    input.isGood
    ?? (input.source !== 'none' && input.sourceHealth !== 'degraded' && input.cacheStatus !== 'rejected')
  );

  if (isGood) {
    await pgQuery(
      `
        UPDATE data_snapshots
        SET is_last_good = FALSE
        WHERE domain = $1 AND cache_key = $2 AND is_last_good = TRUE
      `,
      [input.domain, input.cacheKey]
    );
  }

  await pgQuery(
    `
      INSERT INTO data_snapshots (
        domain, cache_key, season, date_ref, payload_jsonb, source, source_health, cache_status,
        error_code, coverage, captured_at, expires_at, is_last_good
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13
      )
    `,
    [
      input.domain,
      input.cacheKey,
      input.season || null,
      input.dateRef || null,
      JSON.stringify(input.payload ?? null),
      input.source || 'none',
      input.sourceHealth || 'degraded',
      input.cacheStatus || 'rejected',
      input.errorCode || null,
      Number.isFinite(Number(input.coverage)) ? Number(input.coverage) : null,
      capturedAt,
      expiresAt,
      isGood,
    ]
  );

  return { capturedAt };
}

export async function markLastGood(domain: SnapshotDomain, cacheKey: string): Promise<void> {
  if (!isPgConfigured()) return;
  await ensureDataSnapshotsTable();
  await pgQuery(
    `
      WITH latest AS (
        SELECT id
        FROM data_snapshots
        WHERE domain = $1 AND cache_key = $2
        ORDER BY captured_at DESC
        LIMIT 1
      )
      UPDATE data_snapshots
      SET is_last_good = CASE WHEN id IN (SELECT id FROM latest) THEN TRUE ELSE FALSE END
      WHERE domain = $1 AND cache_key = $2
    `,
    [domain, cacheKey]
  );
}

export async function pruneExpired(): Promise<number> {
  if (!isPgConfigured()) return 0;
  await ensureDataSnapshotsTable();
  const rows = await pgQuery<{ deleted_count: number }>(
    `
      WITH deleted AS (
        DELETE FROM data_snapshots
        WHERE expires_at < NOW() - INTERVAL '7 days'
          AND is_last_good = FALSE
        RETURNING 1
      )
      SELECT COUNT(*)::int AS deleted_count FROM deleted
    `
  );
  return Number(rows[0]?.deleted_count || 0);
}

export async function getSnapshotMetrics(): Promise<{
  byDomain: Record<string, { total: number; lastCapturedAt: string | null }>;
}> {
  if (!isPgConfigured()) return { byDomain: {} };
  await ensureDataSnapshotsTable();
  const rows = await pgQuery<{ domain: string; total: number; last_captured_at: string | null }>(
    `
      SELECT domain, COUNT(*)::int AS total, MAX(captured_at) AS last_captured_at
      FROM data_snapshots
      GROUP BY domain
    `
  );
  const byDomain: Record<string, { total: number; lastCapturedAt: string | null }> = {};
  for (const row of rows) {
    byDomain[String(row.domain)] = {
      total: Number(row.total || 0),
      lastCapturedAt: row.last_captured_at || null,
    };
  }
  return { byDomain };
}
