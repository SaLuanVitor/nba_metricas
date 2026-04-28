import { NextResponse } from "next/server";
import { calculateOverUnder, aiEngine } from "@/lib/ai/engine";
import { getDataOrchestrator } from "@/lib/data-orchestrator";
import { getMarketSnapshotsByGame, type MarketSnapshot, type MarketType } from "@/lib/odds/market-store";
import { americanOddsToImpliedProb, calculateEdge, expectedValuePerUnit, toPercent } from "@/lib/odds/market-utils";
import { buildPredictionId, savePrediction } from "@/lib/predictions/registry";
import type {
  AuditablePrediction,
  PredictionInputSnapshot,
  PredictionMarket,
  PredictionOutput,
  RiskLevel,
} from "@/lib/predictions/contracts";
import type { Player } from "@/lib/types";

const MARKET_TO_METRIC: Record<PredictionMarket, "points" | "assists" | "rebounds"> = {
  player_points: "points",
  player_assists: "assists",
  player_rebounds: "rebounds",
};

function isPlayerMarket(marketType: MarketType): marketType is PredictionMarket {
  return marketType === "player_points" || marketType === "player_assists" || marketType === "player_rebounds";
}

function parseMarketFilter(value: string | null): PredictionMarket | null {
  return value && isPlayerMarket(value as MarketType) ? value as PredictionMarket : null;
}

function parseRiskFilter(value: string | null): RiskLevel | null {
  return value === "baixo" || value === "medio" || value === "alto" ? value : null;
}

function parseNumberFilter(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function riskFrom(probability: number, confidence: string, edge: number | null): RiskLevel {
  if (probability >= 62 && (edge ?? 0) >= 0.04 && (confidence === "high" || confidence === "very-high")) return "baixo";
  if (probability >= 55 && (edge ?? 0) >= 0.01) return "medio";
  return "alto";
}

function buildReasons(params: {
  player: Player;
  market: PredictionMarket;
  probability: number;
  line: number;
  edge: number | null;
  sourceHealth: string;
}): string[] {
  const metric = MARKET_TO_METRIC[params.market];
  const projection = params.market === "player_points"
    ? params.player.projection?.projectedPoints
    : params.market === "player_assists"
      ? params.player.projection?.projectedAssists
      : params.player.projection?.projectedRebounds;
  const season = Number(params.player.seasonStats?.[metric] || 0);
  const reasons = [
    `Probabilidade estimada de over em ${params.probability.toFixed(1)}%.`,
    `Linha ${params.line}; projecao atual ${Number(projection || 0).toFixed(1)} e media da temporada ${season.toFixed(1)}.`,
  ];
  if (params.edge !== null) reasons.push(`Edge contra probabilidade implicita: ${toPercent(params.edge).toFixed(2)}%.`);
  if (params.player.injury) reasons.push(`Risco de lesao/status: ${params.player.injury.status}.`);
  if (params.sourceHealth !== "ok") reasons.push("Cobertura de fonte degradada; tratar como sinal de maior risco.");
  return reasons;
}

function buildAuditablePrediction(params: {
  game: any;
  player: Player;
  market: PredictionMarket;
  snapshot: MarketSnapshot;
  source: string;
  sourceHealth: "ok" | "degraded";
  cacheStatus: "fresh" | "stale" | "rejected";
}): AuditablePrediction {
  const metric = MARKET_TO_METRIC[params.market];
  const line = Number(params.snapshot.line);
  const probabilityResult = calculateOverUnder(params.player, metric, line);
  const probability = probabilityResult.over;
  const impliedProb = Number.isFinite(Number(params.snapshot.impliedProb))
    ? Number(params.snapshot.impliedProb)
    : americanOddsToImpliedProb(Number(params.snapshot.americanOdds));
  const edge = Number.isFinite(impliedProb) && impliedProb > 0 ? calculateEdge(probability / 100, impliedProb) : null;
  const expectedValue = Number.isFinite(Number(params.snapshot.americanOdds))
    ? expectedValuePerUnit(probability / 100, Number(params.snapshot.americanOdds))
    : null;
  const modelVersion = aiEngine.getModelInfo().version;
  const predictionId = buildPredictionId({
    gameId: String(params.game.gameId || params.game.id),
    playerId: params.player.id,
    market: params.market,
    side: "over",
    line,
    modelVersion,
    capturedAt: params.snapshot.timestamp,
  });
  const generatedAt = new Date().toISOString();
  const inputSnapshot: PredictionInputSnapshot = {
    gameId: String(params.game.gameId || params.game.id),
    playerId: params.player.id,
    playerName: params.player.name,
    team: params.player.team?.abbreviation,
    opponent: String(params.game.homeTeam?.abbreviation || "") === String(params.player.team?.abbreviation || "")
      ? params.game.awayTeam?.abbreviation
      : params.game.homeTeam?.abbreviation,
    market: params.market,
    side: "over",
    line,
    sportsbook: params.snapshot.sportsbook,
    americanOdds: Number.isFinite(Number(params.snapshot.americanOdds)) ? Number(params.snapshot.americanOdds) : null,
    marketSnapshot: params.snapshot,
    playerProjection: {
      projectedPoints: params.player.projection?.projectedPoints,
      projectedAssists: params.player.projection?.projectedAssists,
      projectedRebounds: params.player.projection?.projectedRebounds,
      confidence: params.player.projection?.confidence,
    },
    seasonStats: {
      points: Number(params.player.seasonStats?.points || 0),
      assists: Number(params.player.seasonStats?.assists || 0),
      rebounds: Number(params.player.seasonStats?.rebounds || 0),
      minutes: Number(params.player.seasonStats?.minutes || 0),
    },
    generatedAt,
  };
  const output: PredictionOutput = {
    predictionId,
    modelVersion,
    probability,
    confidence: probabilityResult.confidence,
    edge: edge === null ? null : Number(edge.toFixed(4)),
    expectedValue: expectedValue === null ? null : Number(expectedValue.toFixed(4)),
    riskLevel: riskFrom(probability, probabilityResult.confidence, edge),
    reasons: buildReasons({
      player: params.player,
      market: params.market,
      probability,
      line,
      edge,
      sourceHealth: params.sourceHealth,
    }),
    factors: probabilityResult.factors,
  };

  return {
    id: predictionId,
    gameId: String(params.game.gameId || params.game.id),
    playerId: params.player.id,
    market: params.market,
    side: "over",
    line,
    modelVersion,
    inputSnapshot,
    output,
    outcome: { status: "pending" },
    createdAt: generatedAt,
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  };
}

export async function GET(request: Request) {
  const generatedAt = new Date().toISOString();
  const { searchParams } = new URL(request.url);
  const filters = {
    gameId: searchParams.get("gameId")?.trim() || null,
    market: parseMarketFilter(searchParams.get("market")),
    riskLevel: parseRiskFilter(searchParams.get("riskLevel")),
    minEdgePct: parseNumberFilter(searchParams.get("minEdgePct")),
    minProbability: parseNumberFilter(searchParams.get("minProbability")),
  };
  const minEdgeDecimal = filters.minEdgePct === null ? null : filters.minEdgePct / 100;
  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const [gamesResult, playersResult] = await Promise.all([
    orchestrator.getGamesToday(),
    orchestrator.getPlayers(season),
  ]);
  const games = (Array.isArray(gamesResult.data) ? gamesResult.data : [])
    .filter((game: any) => !filters.gameId || String(game.gameId || game.id) === filters.gameId);
  const players = Array.isArray(playersResult.data) ? playersResult.data : [];
  const playersById = new Map(players.map((player: Player) => [String(player.id), player]));
  let scannedPlayerMarketSnapshots = 0;
  const picks: Array<PredictionOutput & {
    gameId: string;
    playerId: string;
    playerName: string;
    team?: string;
    market: PredictionMarket;
    side: "over";
    line: number;
    sportsbook?: string;
    americanOdds?: number | null;
    auditUrl: string;
  }> = [];

  for (const game of games) {
    const gameId = String(game.gameId || game.id);
    const snapshots = await getMarketSnapshotsByGame(gameId);
    const latestByPlayerMarket = new Map<string, MarketSnapshot>();

    for (const snapshot of snapshots) {
      if (!snapshot.playerId || !isPlayerMarket(snapshot.marketType) || !Number.isFinite(Number(snapshot.line))) continue;
      scannedPlayerMarketSnapshots += 1;
      if (filters.market && snapshot.marketType !== filters.market) continue;
      const key = `${snapshot.playerId}:${snapshot.marketType}`;
      const existing = latestByPlayerMarket.get(key);
      if (!existing || new Date(snapshot.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        latestByPlayerMarket.set(key, snapshot);
      }
    }

    for (const snapshot of latestByPlayerMarket.values()) {
      const player = playersById.get(String(snapshot.playerId));
      if (!player) continue;
      const prediction = buildAuditablePrediction({
        game,
        player,
        market: snapshot.marketType as PredictionMarket,
        snapshot,
        source: "boltodds",
        sourceHealth: gamesResult.sourceHealth === "ok" && playersResult.sourceHealth === "ok" ? "ok" : "degraded",
        cacheStatus: gamesResult.cacheStatus === "rejected" ? "rejected" : "fresh",
      });
      if (filters.riskLevel && prediction.output.riskLevel !== filters.riskLevel) continue;
      if (filters.minProbability !== null && prediction.output.probability < filters.minProbability) continue;
      if (minEdgeDecimal !== null && (prediction.output.edge === null || prediction.output.edge < minEdgeDecimal)) continue;
      await savePrediction({
        prediction,
        source: "boltodds",
        sourceHealth: gamesResult.sourceHealth === "ok" && playersResult.sourceHealth === "ok" ? "ok" : "degraded",
        cacheStatus: gamesResult.cacheStatus === "rejected" ? "rejected" : "fresh",
      });
      picks.push({
        ...prediction.output,
        gameId: prediction.gameId,
        playerId: prediction.playerId,
        playerName: prediction.inputSnapshot.playerName,
        team: prediction.inputSnapshot.team,
        market: prediction.market,
        side: "over",
        line: prediction.line,
        sportsbook: prediction.inputSnapshot.sportsbook,
        americanOdds: prediction.inputSnapshot.americanOdds,
        auditUrl: `/api/predictions/${prediction.id}`,
      });
    }
  }

  picks.sort((a, b) => {
    const edgeA = a.edge ?? -999;
    const edgeB = b.edge ?? -999;
    if (edgeA !== edgeB) return edgeB - edgeA;
    return b.probability - a.probability;
  });

  const noOddsWarning = "No usable player market snapshots available for today's games. Run POST /api/odds/collect after configuring BOLTODDS_API_KEY.";
  const warning = picks.length > 0
    ? gamesResult.warning || playersResult.warning
    : [gamesResult.warning, playersResult.warning, noOddsWarning].filter(Boolean).join(" | ");

  return NextResponse.json({
    success: true,
    data: {
      games: games.map((game: any) => ({
        id: String(game.gameId || game.id),
        status: game.status,
        date: game.date,
        gameTime: game.gameTime,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
      })),
      picks,
      modelVersion: aiEngine.getModelInfo().version,
      filters,
      oddsSnapshotStatus: {
        scannedPlayerMarketSnapshots,
        hasUsableSnapshots: scannedPlayerMarketSnapshots > 0,
        collectionRequired: scannedPlayerMarketSnapshots === 0,
        collectEndpoint: "/api/odds/collect",
      },
    },
    source: picks.length > 0 ? "boltodds" : (gamesResult.source || playersResult.source || "none"),
    sourceHealth: gamesResult.sourceHealth === "ok" && playersResult.sourceHealth === "ok" && picks.length > 0 ? "ok" : "degraded",
    cacheStatus: gamesResult.cacheStatus === "rejected" && playersResult.cacheStatus === "rejected" ? "rejected" : "fresh",
    warning,
    errorCode: picks.length > 0 ? undefined : (gamesResult.errorCode || playersResult.errorCode),
    generatedAt,
  });
}
