import { NextResponse } from "next/server";
import { listModelRuns } from "@/lib/predictions/model-runs";

export async function GET() {
  const generatedAt = new Date().toISOString();
  const data = await listModelRuns();

  return NextResponse.json({
    success: true,
    data,
    source: "none",
    sourceHealth: "ok",
    cacheStatus: "fresh",
    generatedAt,
  });
}
