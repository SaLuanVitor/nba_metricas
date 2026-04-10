import { ensureAiLearningTable, isPgConfigured, pgQuery } from '@/lib/db/pg';
import { createHash } from 'crypto';

export type SpecialistEntityType = 'player' | 'team';
export type LearningStatus = 'saved' | 'skipped_window' | 'skipped_no_change' | 'disabled';

export type SpecialistLearning = {
  id: string;
  entityType: SpecialistEntityType;
  entityId: string;
  source: string;
  confidence: number;
  learning: Record<string, any>;
  learningDigest?: string;
  tags: string[];
  capturedAt: string;
  createdAt: string;
};

const LEARNING_WINDOW_MS = 5 * 60 * 1000;

function digestPayload(payload: Record<string, any>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function diffKeys(previous: Record<string, any>, current: Record<string, any>): string[] {
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(current || {})]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(previous?.[key]) !== JSON.stringify(current?.[key])) changed.push(key);
  }
  return changed;
}

export async function getLatestSpecialistLearning(
  entityType: SpecialistEntityType,
  entityId: string
): Promise<SpecialistLearning | null> {
  if (!isPgConfigured()) return null;
  try {
    await ensureAiLearningTable();
    const rows = await pgQuery<any>(
      `
      SELECT id, entity_type, entity_id, source, confidence, learning, learning_digest, tags, captured_at, created_at
      FROM ai_specialist_learnings
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [entityType, entityId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      entityType: row.entity_type,
      entityId: row.entity_id,
      source: row.source,
      confidence: Number(row.confidence || 0),
      learning: row.learning || {},
      learningDigest: row.learning_digest || undefined,
      tags: Array.isArray(row.tags) ? row.tags : [],
      capturedAt: new Date(row.captured_at || row.created_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveSpecialistLearning(input: {
  entityType: SpecialistEntityType;
  entityId: string;
  source: string;
  confidence: number;
  learning: Record<string, any>;
  sourceHealth?: 'ok' | 'degraded';
  cacheStatus?: 'fresh' | 'stale' | 'rejected';
  tags?: string[];
}): Promise<{ persisted: boolean; status: LearningStatus; warning?: string; lastPersistedAt?: string }> {
  if (!isPgConfigured()) {
    return { persisted: false, status: 'disabled', warning: 'DATABASE_URL not configured; learning not persisted' };
  }

  try {
    await ensureAiLearningTable();
    const capturedAt = new Date().toISOString();
    const lastLearning = await getLatestSpecialistLearning(input.entityType, input.entityId);
    const prediction = input.learning?.prediction || {};
    const explainability = input.learning?.explainability || {};
    const learningCore = {
      prediction,
      explainability,
    };
    const learningDigest = digestPayload(learningCore);
    const lastCore = {
      prediction: lastLearning?.learning?.prediction || {},
      explainability: lastLearning?.learning?.explainability || {},
    };

    if (lastLearning) {
      const lastCapturedAt = new Date(lastLearning.capturedAt).getTime();
      const ageMs = Date.now() - lastCapturedAt;
      if (ageMs < LEARNING_WINDOW_MS) {
        console.info(`[SPECIALIST_LEARNING_SKIPPED_WINDOW] entity=${input.entityType}:${input.entityId} ageMs=${ageMs}`);
        return {
          persisted: false,
          status: 'skipped_window',
          warning: `Learning window active (${Math.ceil((LEARNING_WINDOW_MS - ageMs) / 1000)}s remaining)`,
          lastPersistedAt: lastLearning.capturedAt,
        };
      }
      if (lastLearning.learningDigest === learningDigest) {
        console.info(`[SPECIALIST_LEARNING_SKIPPED_NO_CHANGE] entity=${input.entityType}:${input.entityId}`);
        return {
          persisted: false,
          status: 'skipped_no_change',
          warning: 'No relevant change detected since last learning snapshot',
          lastPersistedAt: lastLearning.capturedAt,
        };
      }
    }

    const changed = diffKeys(lastCore, learningCore);
    const enrichedLearning = {
      ...input.learning,
      metadata: {
        version: 'v1',
        capturedAt,
        sourceHealth: input.sourceHealth || 'degraded',
        cacheStatus: input.cacheStatus || 'rejected',
        diffKeys: changed,
      },
    };

    await pgQuery(
      `
      INSERT INTO ai_specialist_learnings (entity_type, entity_id, source, confidence, learning, learning_digest, tags, captured_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::text[], $8::timestamptz)
      `,
      [
        input.entityType,
        input.entityId,
        input.source,
        Number(input.confidence || 0),
        JSON.stringify(enrichedLearning),
        learningDigest,
        input.tags || [],
        capturedAt,
      ]
    );
    console.info(`[SPECIALIST_LEARNING_SAVED] entity=${input.entityType}:${input.entityId}`);
    return { persisted: true, status: 'saved', lastPersistedAt: capturedAt };
  } catch (error: any) {
    return { persisted: false, status: 'disabled', warning: `Failed to persist learning: ${error?.message || 'unknown error'}` };
  }
}

export async function getRecentSpecialistLearnings(
  entityType: SpecialistEntityType,
  entityId: string,
  limit = 20
): Promise<SpecialistLearning[]> {
  if (!isPgConfigured()) return [];
  try {
    await ensureAiLearningTable();
    const rows = await pgQuery<any>(
      `
      SELECT id, entity_type, entity_id, source, confidence, learning, learning_digest, tags, captured_at, created_at
      FROM ai_specialist_learnings
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [entityType, entityId, Math.max(1, Math.min(200, limit))]
    );
    return rows.map((row) => ({
      id: String(row.id),
      entityType: row.entity_type,
      entityId: row.entity_id,
      source: row.source,
      confidence: Number(row.confidence || 0),
      learning: row.learning || {},
      learningDigest: row.learning_digest || undefined,
      tags: Array.isArray(row.tags) ? row.tags : [],
      capturedAt: new Date(row.captured_at || row.created_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}
