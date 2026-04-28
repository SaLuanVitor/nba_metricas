import { getDataOrchestrator } from "@/lib/data-orchestrator";
import { getPredictionById, listPendingPredictionsByGame, savePredictionOutcome } from "@/lib/predictions/registry";
import type { AuditablePrediction, PredictionMarket, PredictionOutcome } from "@/lib/predictions/contracts";

type SettlementResult = {
  predictionId: string;
  status: PredictionOutcome["status"];
  actualValue: number | null;
  outcome: PredictionOutcome;
  warning?: string;
};

function metricForMarket(market: PredictionMarket): "points" | "assists" | "rebounds" {
  if (market === "player_assists") return "assists";
  if (market === "player_rebounds") return "rebounds";
  return "points";
}

function payoutForAmericanOdds(americanOdds?: number | null): number {
  if (!Number.isFinite(Number(americanOdds)) || Number(americanOdds) === 0) return 1;
  const odds = Number(americanOdds);
  return odds > 0 ? odds / 100 : 100 / Math.abs(odds);
}

export function buildPredictionOutcome(input: {
  prediction: AuditablePrediction;
  actualValue: number;
  settledAt?: string;
}): PredictionOutcome {
  const { prediction } = input;
  const actualValue = Number(input.actualValue);
  const line = Number(prediction.line);
  const isPush = actualValue === line;
  const won = prediction.side === "over" ? actualValue > line : actualValue < line;
  const status: PredictionOutcome["status"] = isPush ? "push" : won ? "won" : "lost";
  const roiUnits = status === "push"
    ? 0
    : status === "won"
      ? payoutForAmericanOdds(prediction.inputSnapshot.americanOdds)
      : -1;
  const probability = Math.max(0, Math.min(1, Number(prediction.output.probability || 0) / 100));
  const brierScore = status === "push" ? null : Number(((probability - (won ? 1 : 0)) ** 2).toFixed(6));

  return {
    status,
    actualValue,
    settledAt: input.settledAt || new Date().toISOString(),
    roiUnits: Number(roiUnits.toFixed(4)),
    errorAbs: Number(Math.abs(actualValue - line).toFixed(4)),
    brierScore,
  };
}

function findPlayerBoxscore(boxscore: any, playerId: string): any | null {
  const teams = [boxscore?.homeTeam, boxscore?.awayTeam].filter(Boolean);
  for (const team of teams) {
    const player = (team?.players || []).find((row: any) => String(row?.playerId) === String(playerId));
    if (player) return player;
  }
  return null;
}

export async function settlePredictionByActualValue(input: {
  predictionId: string;
  actualValue: number;
  settledAt?: string;
}): Promise<SettlementResult | null> {
  const prediction = await getPredictionById(input.predictionId);
  if (!prediction) return null;
  const outcome = buildPredictionOutcome({
    prediction,
    actualValue: input.actualValue,
    settledAt: input.settledAt,
  });
  await savePredictionOutcome({ predictionId: prediction.id, outcome });
  return {
    predictionId: prediction.id,
    status: outcome.status,
    actualValue: outcome.actualValue ?? null,
    outcome,
  };
}

export async function settlePredictionsForGame(gameId: string): Promise<{
  gameId: string;
  settled: SettlementResult[];
  skipped: SettlementResult[];
  warning?: string;
}> {
  const predictions = await listPendingPredictionsByGame(gameId);
  if (!predictions.length) {
    return { gameId, settled: [], skipped: [], warning: "No pending predictions found for game" };
  }

  const orchestrator = getDataOrchestrator();
  const boxscoreResult = await orchestrator.getGameBoxscore(gameId);
  const boxscore = boxscoreResult.data;
  if (!boxscore) {
    return { gameId, settled: [], skipped: [], warning: boxscoreResult.warning || "Final boxscore unavailable" };
  }

  const settled: SettlementResult[] = [];
  const skipped: SettlementResult[] = [];
  for (const prediction of predictions) {
    const playerBoxscore = findPlayerBoxscore(boxscore, prediction.playerId);
    const metric = metricForMarket(prediction.market);
    const actualValue = Number(playerBoxscore?.[metric]);
    if (!playerBoxscore || !Number.isFinite(actualValue)) {
      skipped.push({
        predictionId: prediction.id,
        status: "void",
        actualValue: null,
        outcome: { status: "void", actualValue: null, settledAt: null, roiUnits: null, errorAbs: null, brierScore: null },
        warning: "Player metric not found in boxscore",
      });
      continue;
    }
    const result = await settlePredictionByActualValue({
      predictionId: prediction.id,
      actualValue,
    });
    if (result) settled.push(result);
  }

  return {
    gameId,
    settled,
    skipped,
    warning: boxscoreResult.warning,
  };
}
