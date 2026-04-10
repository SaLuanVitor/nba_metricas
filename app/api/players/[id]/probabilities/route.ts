import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { calculateDoubleDouble, calculateOverUnder, calculateTripleDouble } from '@/lib/ai/engine';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const result = await orchestrator.getPlayerById(id, season);
  const player = result.data;

  if (!player) {
    return NextResponse.json({
      success: true,
      data: null,
      source: result.source,
      sourceHealth: result.sourceHealth ?? 'degraded',
      cacheStatus: result.cacheStatus ?? 'rejected',
      warning: result.warning || 'Player not found',
      errorCode: result.errorCode,
    });
  }

  const pointsLine = Number((player.projection.projectedPoints || 0).toFixed(1));
  const assistsLine = Number((player.projection.projectedAssists || 0).toFixed(1));
  const reboundsLine = Number((player.projection.projectedRebounds || 0).toFixed(1));

  const points = calculateOverUnder(player, 'points', pointsLine);
  const assists = calculateOverUnder(player, 'assists', assistsLine);
  const rebounds = calculateOverUnder(player, 'rebounds', reboundsLine);

  return NextResponse.json({
    success: true,
    data: {
      playerId: player.id,
      overUnder: {
        points: { line: pointsLine, ...points },
        assists: { line: assistsLine, ...assists },
        rebounds: { line: reboundsLine, ...rebounds },
      },
      doubleDouble: calculateDoubleDouble(player),
      tripleDouble: calculateTripleDouble(player),
    },
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: result.warning,
    errorCode: result.errorCode,
  });
}
