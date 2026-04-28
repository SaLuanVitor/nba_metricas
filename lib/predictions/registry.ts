import { createHash } from "crypto";
import { ensureOperationalTables, isPgConfigured, pgQuery } from "@/lib/db/pg";
import type {
  AuditablePrediction,
  CacheStatus,
  PredictionInputSnapshot,
  PredictionMarket,
  PredictionOutcome,
  PredictionOutput,
  PredictionSide,
  SourceHealth,
} from "@/lib/predictions/contracts";

type PredictionRow = {
  id: string;
  game_id: string;
  player_id: string;
  market: PredictionMarket;
  side: PredictionSide;
  line: string | number;
  model_version: string;
  input_jsonb: PredictionInputSnapshot;
  output_jsonb: PredictionOutput;
  source: string;
  source_health: SourceHealth;
  cache_status: CacheStatus;
  created_at: string;
  expires_at: string;
  settlement_status: PredictionOutcome["status"];
  actual_value: string | number | null;
  settled_at: string | null;
  roi_units: string | number | null;
  error_abs: string | number | null;
  brier_score: string | number | null;
};

export function buildPredictionId(input: {
  gameId: string;
  playerId: string;
  market: string;
  side: string;
  line: number;
  modelVersion: string;
  capturedAt?: string;
}): string {
  const digest = createHash("sha256")
    .update([
      input.gameId,
      input.playerId,
      input.market,
      input.side,
      input.line.toFixed(2),
      input.modelVersion,
      input.capturedAt || "",
    ].join("|"))
    .digest("hex")
    .slice(0, 24);
  return `pred_${digest}`;
}

function rowToPrediction(row: PredictionRow): AuditablePrediction {
  return {
    id: row.id,
    gameId: row.game_id,
    playerId: row.player_id,
    market: row.market,
    side: row.side,
    line: Number(row.line),
    modelVersion: row.model_version,
    inputSnapshot: row.input_jsonb,
    output: row.output_jsonb,
    outcome: {
      status: row.settlement_status || "pending",
      actualValue: row.actual_value === null ? null : Number(row.actual_value),
      settledAt: row.settled_at,
      roiUnits: row.roi_units === null ? null : Number(row.roi_units),
      errorAbs: row.error_abs === null ? null : Number(row.error_abs),
      brierScore: row.brier_score === null ? null : Number(row.brier_score),
    },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function savePrediction(input: {
  prediction: AuditablePrediction;
  source: string;
  sourceHealth: SourceHealth;
  cacheStatus: CacheStatus;
}): Promise<void> {
  if (!isPgConfigured()) return;
  await ensureOperationalTables();
  const { prediction } = input;
  await pgQuery(
    `
      INSERT INTO predictions (
        id, game_id, player_id, market, side, line, model_version, probability, confidence,
        edge, expected_value, risk_level, input_jsonb, output_jsonb, source, source_health,
        cache_status, created_at, expires_at, settlement_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13::jsonb, $14::jsonb, $15, $16, $17, $18::timestamptz, $19::timestamptz, $20
      )
      ON CONFLICT (id) DO UPDATE SET
        probability=EXCLUDED.probability,
        confidence=EXCLUDED.confidence,
        edge=EXCLUDED.edge,
        expected_value=EXCLUDED.expected_value,
        risk_level=EXCLUDED.risk_level,
        input_jsonb=EXCLUDED.input_jsonb,
        output_jsonb=EXCLUDED.output_jsonb,
        source=EXCLUDED.source,
        source_health=EXCLUDED.source_health,
        cache_status=EXCLUDED.cache_status,
        expires_at=EXCLUDED.expires_at
    `,
    [
      prediction.id,
      prediction.gameId,
      prediction.playerId,
      prediction.market,
      prediction.side,
      prediction.line,
      prediction.modelVersion,
      prediction.output.probability,
      prediction.output.confidence,
      prediction.output.edge,
      prediction.output.expectedValue,
      prediction.output.riskLevel,
      JSON.stringify(prediction.inputSnapshot),
      JSON.stringify(prediction.output),
      input.source,
      input.sourceHealth,
      input.cacheStatus,
      prediction.createdAt,
      prediction.expiresAt,
      prediction.outcome.status,
    ]
  );
}

export async function getPredictionById(id: string): Promise<AuditablePrediction | null> {
  if (!isPgConfigured()) return null;
  await ensureOperationalTables();
  const rows = await pgQuery<PredictionRow>(
    `
      SELECT p.*, o.status AS settlement_status, o.actual_value, o.settled_at, o.roi_units, o.error_abs, o.brier_score
      FROM predictions p
      LEFT JOIN prediction_outcomes o ON o.prediction_id = p.id
      WHERE p.id = $1
      LIMIT 1
    `,
    [id]
  );
  return rows[0] ? rowToPrediction(rows[0]) : null;
}

export async function getSettledPredictionMetrics(): Promise<{
  total: number;
  wins: number;
  losses: number;
  pushes: number;
  accuracy: number | null;
  roi: number | null;
  avgErrorAbs: number | null;
  brierScore: number | null;
}> {
  if (!isPgConfigured()) {
    return { total: 0, wins: 0, losses: 0, pushes: 0, accuracy: null, roi: null, avgErrorAbs: null, brierScore: null };
  }
  await ensureOperationalTables();
  const rows = await pgQuery<{
    total: number;
    wins: number;
    losses: number;
    pushes: number;
    roi: string | number | null;
    avg_error_abs: string | number | null;
    avg_brier: string | number | null;
  }>(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='won')::int AS wins,
        COUNT(*) FILTER (WHERE status='lost')::int AS losses,
        COUNT(*) FILTER (WHERE status='push')::int AS pushes,
        AVG(roi_units) AS roi,
        AVG(error_abs) AS avg_error_abs,
        AVG(brier_score) AS avg_brier
      FROM prediction_outcomes
      WHERE status IN ('won', 'lost', 'push')
    `
  );
  const row = rows[0];
  const totalDecided = Number(row?.wins || 0) + Number(row?.losses || 0);
  return {
    total: Number(row?.total || 0),
    wins: Number(row?.wins || 0),
    losses: Number(row?.losses || 0),
    pushes: Number(row?.pushes || 0),
    accuracy: totalDecided ? Number(((Number(row?.wins || 0) / totalDecided) * 100).toFixed(2)) : null,
    roi: row?.roi === null || row?.roi === undefined ? null : Number((Number(row.roi) * 100).toFixed(2)),
    avgErrorAbs: row?.avg_error_abs === null || row?.avg_error_abs === undefined ? null : Number(Number(row.avg_error_abs).toFixed(2)),
    brierScore: row?.avg_brier === null || row?.avg_brier === undefined ? null : Number(Number(row.avg_brier).toFixed(4)),
  };
}
