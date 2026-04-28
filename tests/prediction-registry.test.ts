import { describe, expect, it } from "vitest";
import { buildPredictionId } from "@/lib/predictions/registry";

const baseInput = {
  gameId: "game_1",
  playerId: "player_1",
  market: "player_points",
  side: "over",
  line: 20.5,
  modelVersion: "prediction-engine-v1",
  capturedAt: "2026-04-28T12:00:00.000Z",
};

describe("prediction registry identifiers", () => {
  it("builds deterministic prediction ids for the same input snapshot", () => {
    expect(buildPredictionId(baseInput)).toBe(buildPredictionId(baseInput));
  });

  it("changes ids when auditable input dimensions change", () => {
    const first = buildPredictionId(baseInput);
    const second = buildPredictionId({ ...baseInput, line: 21.5 });

    expect(first).not.toBe(second);
  });

  it("uses the expected prediction id prefix", () => {
    expect(buildPredictionId(baseInput)).toMatch(/^pred_[a-f0-9]{24}$/);
  });
});
