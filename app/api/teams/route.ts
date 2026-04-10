import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { buildFallbackTeamsFromPlayers } from '@/lib/nba/team-fallback';

export async function GET() {
  console.log('=== TEAMS API ===');

  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const [teamsResult, playersResult] = await Promise.all([
    orchestrator.getTeams(season),
    orchestrator.getPlayers(season),
  ]);
  const fallbackTeams =
    (!teamsResult.data || teamsResult.data.length === 0) && Array.isArray(playersResult.data)
      ? buildFallbackTeamsFromPlayers(playersResult.data)
      : [];
  const teams = (teamsResult.data && teamsResult.data.length > 0)
    ? teamsResult.data
    : fallbackTeams;

  return NextResponse.json({
    success: true,
    data: teams,
    source: teamsResult.source !== 'none' ? teamsResult.source : (playersResult.source || 'none'),
    sourceHealth:
      teamsResult.sourceHealth === 'ok' || playersResult.sourceHealth === 'ok'
        ? 'ok'
        : (teamsResult.sourceHealth ?? 'degraded'),
    cacheStatus: teamsResult.cacheStatus ?? 'rejected',
    warning: teams.length > 0 && teamsResult.warning
      ? `${teamsResult.warning} | usando fallback de times via jogadores.`
      : teamsResult.warning,
    errorCode: teamsResult.errorCode,
    total: teams.length,
    season: season || 'current',
  });
}
