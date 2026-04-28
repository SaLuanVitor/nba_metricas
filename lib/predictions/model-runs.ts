import { aiEngine } from "@/lib/ai/engine";
import { getSettledPredictionMetrics } from "@/lib/predictions/registry";
import type { ModelRun } from "@/lib/predictions/contracts";

export async function listModelRuns(): Promise<ModelRun[]> {
  const settled = await getSettledPredictionMetrics();
  const info = aiEngine.getModelInfo();

  return [
    {
      id: "prediction-engine-v1-current",
      modelVersion: info.version,
      status: "active",
      methodology: info.methodology,
      trainingWindow: "Heuristic baseline; no statistical training window yet",
      validationWindow: "Settled predictions stored in prediction_outcomes",
      metrics: {
        sampleSize: settled.total,
        accuracy: settled.accuracy,
        roi: settled.roi,
        brierScore: settled.brierScore,
        calibration: settled.total > 0 ? "outcome-backed" : "pending settled sample",
      },
      createdAt: info.lastTraining.toISOString(),
    },
  ];
}
