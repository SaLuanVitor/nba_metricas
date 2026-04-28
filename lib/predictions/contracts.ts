import type { MarketSnapshot } from "@/lib/odds/market-store";

export type ApiSource = "nba-stats" | "balldontlie" | "boltodds" | "none";
export type SourceHealth = "ok" | "degraded";
export type CacheStatus = "fresh" | "stale" | "rejected";
export type PredictionMarket = "player_points" | "player_assists" | "player_rebounds";
export type PredictionSide = "over" | "under";
export type RiskLevel = "baixo" | "medio" | "alto";
export type SettlementStatus = "pending" | "won" | "lost" | "push" | "void";

export type ProviderResult<T> = {
  data: T;
  source: ApiSource;
  sourceHealth: SourceHealth;
  cacheStatus: CacheStatus;
  warning?: string;
  errorCode?: string;
  generatedAt: string;
};

export type PredictionInputSnapshot = {
  gameId: string;
  playerId: string;
  playerName: string;
  team?: string;
  opponent?: string;
  market: PredictionMarket;
  side: PredictionSide;
  line: number;
  sportsbook?: string;
  americanOdds?: number | null;
  marketSnapshot?: MarketSnapshot | null;
  playerProjection: {
    projectedPoints?: number;
    projectedAssists?: number;
    projectedRebounds?: number;
    confidence?: number;
  };
  seasonStats: Record<string, number>;
  generatedAt: string;
};

export type PredictionOutput = {
  predictionId: string;
  modelVersion: string;
  probability: number;
  confidence: string;
  edge: number | null;
  expectedValue: number | null;
  riskLevel: RiskLevel;
  reasons: string[];
  factors: Array<{
    name: string;
    impact: number;
    weight: number;
    description: string;
  }>;
};

export type PredictionOutcome = {
  status: SettlementStatus;
  actualValue?: number | null;
  settledAt?: string | null;
  roiUnits?: number | null;
  errorAbs?: number | null;
  brierScore?: number | null;
};

export type AuditablePrediction = {
  id: string;
  gameId: string;
  playerId: string;
  market: PredictionMarket;
  side: PredictionSide;
  line: number;
  modelVersion: string;
  inputSnapshot: PredictionInputSnapshot;
  output: PredictionOutput;
  outcome: PredictionOutcome;
  createdAt: string;
  expiresAt: string;
};

export type ModelRun = {
  id: string;
  modelVersion: string;
  status: "active" | "candidate" | "retired";
  methodology: string;
  trainingWindow: string;
  validationWindow: string;
  metrics: {
    sampleSize: number;
    accuracy: number | null;
    roi: number | null;
    brierScore: number | null;
    calibration: string;
  };
  createdAt: string;
};

export type SyncRun = {
  id: number;
  syncType: string;
  status: "started" | "success" | "failed";
  output?: Record<string, unknown>;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
};
