import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

export async function GET() {
  console.log('=== TEAMS API ===');

  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const result = await orchestrator.getTeams(season);
  const teams = result.data;

  return NextResponse.json({
    success: true,
    data: teams,
    source: result.source,
    sourceHealth: result.sourceHealth ?? 'degraded',
    cacheStatus: result.cacheStatus ?? 'rejected',
    warning: result.warning,
    errorCode: result.errorCode,
    total: teams.length,
    season: season || 'current',
  });
}
