import { NextResponse } from "next/server";
import { getPredictionById } from "@/lib/predictions/registry";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const generatedAt = new Date().toISOString();
  const prediction = await getPredictionById(id);

  if (!prediction) {
    return NextResponse.json({
      success: false,
      data: null,
      source: "none",
      sourceHealth: "degraded",
      cacheStatus: "rejected",
      warning: "Prediction not found or DATABASE_URL is not configured",
      errorCode: "PREDICTION_NOT_FOUND",
      generatedAt,
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: prediction,
    source: "none",
    sourceHealth: "ok",
    cacheStatus: "fresh",
    generatedAt,
  });
}
