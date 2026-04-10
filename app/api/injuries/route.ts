import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

export async function GET() {
  console.log('=== INJURIES API ===');
  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const playersResult = await orchestrator.getPlayers(season);
  const injuries = playersResult.data
    .filter((p: any) => p.injury)
    .map((p: any) => ({
      playerId: p.id,
      playerName: p.name,
      team: p.team?.abbreviation,
      status: p.injury?.status,
      description: p.injury?.description,
    }));

  return NextResponse.json({
    success: true,
    data: injuries,
    total: injuries.length,
    source: playersResult.source,
    sourceHealth: playersResult.sourceHealth ?? 'degraded',
    cacheStatus: playersResult.cacheStatus ?? 'rejected',
    warning: playersResult.warning,
    errorCode: playersResult.errorCode,
  });
}
