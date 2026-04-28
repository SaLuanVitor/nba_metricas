import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getAccuracy } from "@/app/api/accuracy/route";
import { GET as getPrediction } from "@/app/api/predictions/[id]/route";
import { GET as getTodayPredictions } from "@/app/api/predictions/today/route";
import { POST as postSync } from "@/app/api/sync/route";

const mocks = vi.hoisted(() => ({
  getSettledPredictionMetrics: vi.fn(),
  getPredictionById: vi.fn(),
  savePrediction: vi.fn(),
  getGamesToday: vi.fn(),
  getPlayers: vi.fn(),
  getMarketSnapshotsByGame: vi.fn(),
  startSyncRun: vi.fn(),
  finishSyncRun: vi.fn(),
}));

vi.mock("@/lib/predictions/registry", () => ({
  buildPredictionId: (input: { gameId: string; playerId: string; market: string; side: string; line: number }) =>
    `pred_${input.gameId}_${input.playerId}_${input.market}_${input.side}_${input.line}`,
  getSettledPredictionMetrics: mocks.getSettledPredictionMetrics,
  getPredictionById: mocks.getPredictionById,
  savePrediction: mocks.savePrediction,
}));

vi.mock("@/lib/data-orchestrator", () => ({
  getDataOrchestrator: () => ({
    getGamesToday: mocks.getGamesToday,
    getPlayers: mocks.getPlayers,
  }),
}));

vi.mock("@/lib/odds/market-store", () => ({
  getMarketSnapshotsByGame: mocks.getMarketSnapshotsByGame,
}));

vi.mock("@/lib/db/pg", () => ({
  startSyncRun: mocks.startSyncRun,
  finishSyncRun: mocks.finishSyncRun,
}));

vi.mock("@/lib/odds/boltodds-collector", () => ({
  collectBoltOddsMarketSnapshots: vi.fn(),
}));

vi.mock("@/lib/cache/snapshot-store", () => ({
  pruneExpired: vi.fn(),
}));

describe("api route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.getSettledPredictionMetrics.mockResolvedValue({
      total: 3,
      wins: 2,
      losses: 1,
      pushes: 0,
      accuracy: 66.67,
      roi: 12.5,
      avgErrorAbs: 2.25,
      brierScore: 0.1844,
    });
    mocks.getPredictionById.mockResolvedValue(null);
    mocks.getGamesToday.mockResolvedValue({
      data: [{
        gameId: "game_1",
        status: "scheduled",
        date: "2026-04-28",
        homeTeam: { abbreviation: "BOS" },
        awayTeam: { abbreviation: "NYK" },
      }],
      source: "nba-stats",
      sourceHealth: "ok",
      cacheStatus: "fresh",
    });
    mocks.getPlayers.mockResolvedValue({
      data: [],
      source: "nba-stats",
      sourceHealth: "ok",
      cacheStatus: "fresh",
    });
    mocks.getMarketSnapshotsByGame.mockResolvedValue([]);
    mocks.startSyncRun.mockResolvedValue(123);
    mocks.finishSyncRun.mockResolvedValue(undefined);
  });

  it("returns settled accuracy metrics with standardized response fields", async () => {
    const response = await getAccuracy();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.sourceHealth).toBe("ok");
    expect(json.cacheStatus).toBe("fresh");
    expect(json.data.overall.accuracy).toBe(66.67);
    expect(json.data.betting.sampleSize).toBe(3);
    expect(json.data.error.brierScore).toBe(0.1844);
  });

  it("returns an auditable prediction by id", async () => {
    mocks.getPredictionById.mockResolvedValue({
      id: "pred_1",
      gameId: "game_1",
      playerId: "player_1",
      market: "player_points",
      side: "over",
      line: 20.5,
      modelVersion: "prediction-engine-v1",
      inputSnapshot: { playerName: "Test Player" },
      output: { probability: 61, riskLevel: "medio" },
      outcome: { status: "pending" },
      createdAt: "2026-04-28T12:00:00.000Z",
      expiresAt: "2026-04-29T00:00:00.000Z",
    });

    const response = await getPrediction(new Request("http://local/api/predictions/pred_1"), {
      params: Promise.resolve({ id: "pred_1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.sourceHealth).toBe("ok");
    expect(json.data.id).toBe("pred_1");
    expect(json.data.outcome.status).toBe("pending");
  });

  it("returns a standardized 404 for missing prediction audit records", async () => {
    const response = await getPrediction(new Request("http://local/api/predictions/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.errorCode).toBe("PREDICTION_NOT_FOUND");
    expect(json.cacheStatus).toBe("rejected");
  });

  it("returns today predictions payload with degraded status when odds snapshots are missing", async () => {
    const response = await getTodayPredictions(new Request("http://local/api/predictions/today?minProbability=55"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.sourceHealth).toBe("degraded");
    expect(json.data.games).toHaveLength(1);
    expect(json.data.picks).toHaveLength(0);
    expect(json.data.oddsSnapshotStatus.collectionRequired).toBe(true);
    expect(json.warning).toContain("No usable player market snapshots");
  });

  it("rejects sync requests without the configured admin secret", async () => {
    vi.stubEnv("SYNC_ADMIN_SECRET", "test-secret");

    const response = await postSync(new Request("http://local/api/sync", {
      method: "POST",
      body: JSON.stringify({ type: "games", force: true }),
    }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(mocks.startSyncRun).not.toHaveBeenCalled();
  });
});
