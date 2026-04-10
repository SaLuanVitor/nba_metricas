import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

export async function GET() {
  console.log('=== PLAYERS API ===');

  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const result = await orchestrator.getPlayers(season);
  const data = result.data.sort(
    (a: any, b: any) => (b.projection?.projectedPoints || 0) - (a.projection?.projectedPoints || 0)
  );

  return NextResponse.json({
    success: true,
    data,
    source: result.source,
    warning: result.warning,
    errorCode: result.errorCode,
    statsCoverage: result.statsCoverage ?? 0,
    activePlayersCount: result.activePlayersCount ?? data.length,
    cacheStatus: result.cacheStatus ?? 'rejected',
    sourceHealth: result.sourceHealth ?? 'degraded',
    totalPlayers: data.length,
    ai: { enabled: true, model: 'Projection Engine v2' },
  });
}
