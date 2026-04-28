import { describe, expect, it } from "vitest";
import { buildPredictionOutcome } from "@/lib/predictions/settlement";
import type { AuditablePrediction } from "@/lib/predictions/contracts";

function makePrediction(overrides: Partial<AuditablePrediction> = {}): AuditablePrediction {
  return {
    id: "pred_test",
    gameId: "game_1",
    playerId: "player_1",
    market: "player_points",
    side: "over",
    line: 20.5,
    modelVersion: "prediction-engine-v1",
    inputSnapshot: {
      gameId: "game_1",
      playerId: "player_1",
      playerName: "Test Player",
      market: "player_points",
      side: "over",
      line: 20.5,
      americanOdds: -110,
      playerProjection: { projectedPoints: 23, confidence: 70 },
      seasonStats: { points: 21.2 },
      generatedAt: "2026-04-28T12:00:00.000Z",
    },
    output: {
      predictionId: "pred_test",
      modelVersion: "prediction-engine-v1",
      probability: 65,
      confidence: "alta",
      edge: 0.12,
      expectedValue: 0.18,
      riskLevel: "baixo",
      reasons: ["Projection above line"],
      factors: [],
    },
    outcome: { status: "pending" },
    createdAt: "2026-04-28T12:00:00.000Z",
    expiresAt: "2026-04-29T00:00:00.000Z",
    ...overrides,
  };
}

describe("prediction settlement outcome", () => {
  it("settles an over pick as won with payout, error and Brier score", () => {
    const outcome = buildPredictionOutcome({
      prediction: makePrediction(),
      actualValue: 24,
      settledAt: "2026-04-29T02:00:00.000Z",
    });

    expect(outcome.status).toBe("won");
    expect(outcome.actualValue).toBe(24);
    expect(outcome.roiUnits).toBeCloseTo(0.9091, 4);
    expect(outcome.errorAbs).toBe(3.5);
    expect(outcome.brierScore).toBeCloseTo(0.1225, 6);
    expect(outcome.settledAt).toBe("2026-04-29T02:00:00.000Z");
  });

  it("settles an under pick as lost when actual value is above line", () => {
    const outcome = buildPredictionOutcome({
      prediction: makePrediction({ side: "under" }),
      actualValue: 22,
    });

    expect(outcome.status).toBe("lost");
    expect(outcome.roiUnits).toBe(-1);
    expect(outcome.errorAbs).toBe(1.5);
    expect(outcome.brierScore).toBeCloseTo(0.4225, 6);
  });

  it("settles exact line as push without Brier score", () => {
    const outcome = buildPredictionOutcome({
      prediction: makePrediction({ line: 20 }),
      actualValue: 20,
    });

    expect(outcome.status).toBe("push");
    expect(outcome.roiUnits).toBe(0);
    expect(outcome.errorAbs).toBe(0);
    expect(outcome.brierScore).toBeNull();
  });
});
