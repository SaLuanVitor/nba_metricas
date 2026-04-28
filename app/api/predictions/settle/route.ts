import { NextResponse } from "next/server";
import { settlePredictionByActualValue, settlePredictionsForGame } from "@/lib/predictions/settlement";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = String(process.env.SYNC_ADMIN_SECRET || "").trim();
  const isProduction = process.env.NODE_ENV === "production";
  if (!secret) return !isProduction;
  const header = request.headers.get("x-sync-secret") || "";
  const bearer = request.headers.get("authorization") || "";
  if (header && header === secret) return true;
  if (bearer.toLowerCase().startsWith("bearer ") && bearer.slice(7).trim() === secret) return true;
  return false;
}

export async function POST(request: Request) {
  const generatedAt = new Date().toISOString();
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized settlement request", generatedAt }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const predictionId = String(body?.predictionId || "").trim();
  const gameId = String(body?.gameId || "").trim();
  const actualValue = Number(body?.actualValue);

  if (predictionId) {
    if (!Number.isFinite(actualValue)) {
      return NextResponse.json({
        success: false,
        error: "actualValue is required when predictionId is provided",
        errorCode: "INVALID_SETTLEMENT_INPUT",
        generatedAt,
      }, { status: 400 });
    }
    const result = await settlePredictionByActualValue({
      predictionId,
      actualValue,
      settledAt: typeof body?.settledAt === "string" ? body.settledAt : undefined,
    });
    if (!result) {
      return NextResponse.json({
        success: false,
        error: "Prediction not found or DATABASE_URL is not configured",
        errorCode: "PREDICTION_NOT_FOUND",
        generatedAt,
      }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: result,
      source: "none",
      sourceHealth: "ok",
      cacheStatus: "fresh",
      generatedAt,
    });
  }

  if (gameId) {
    const result = await settlePredictionsForGame(gameId);
    return NextResponse.json({
      success: true,
      data: result,
      source: "none",
      sourceHealth: result.settled.length > 0 ? "ok" : "degraded",
      cacheStatus: "fresh",
      warning: result.warning,
      generatedAt,
    });
  }

  return NextResponse.json({
    success: false,
    error: "predictionId or gameId is required",
    errorCode: "INVALID_SETTLEMENT_INPUT",
    generatedAt,
  }, { status: 400 });
}
