import { NextResponse } from "next/server";
import { getSettledPredictionMetrics } from "@/lib/predictions/registry";

export async function GET() {
  const generatedAt = new Date().toISOString();
  const metrics = await getSettledPredictionMetrics();

  return NextResponse.json({
    success: true,
    data: {
      overall: {
        correct: metrics.wins,
        total: metrics.wins + metrics.losses,
        accuracy: metrics.accuracy,
        lastUpdated: generatedAt,
      },
      betting: {
        roi: metrics.roi,
        sampleSize: metrics.total,
        pushes: metrics.pushes,
      },
      error: {
        avgErrorAbs: metrics.avgErrorAbs,
        brierScore: metrics.brierScore,
      },
      period: {
        method: "settled prediction_outcomes",
      },
    },
    source: "none",
    sourceHealth: metrics.total > 0 ? "ok" : "degraded",
    cacheStatus: "fresh",
    warning: metrics.total > 0 ? undefined : "No settled prediction outcomes yet",
    generatedAt,
  });
}
