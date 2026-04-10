import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

type Metric = 'points' | 'assists' | 'rebounds' | 'minutes';

function valueByMetric(player: any, metric: Metric): number {
  if (metric === 'assists') return player.projection?.projectedAssists || 0;
  if (metric === 'rebounds') return player.projection?.projectedRebounds || 0;
  if (metric === 'minutes') return player.projection?.projectedMinutes || 0;
  return player.projection?.projectedPoints || 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team = (searchParams.get('team') || '').toLowerCase();
  const position = (searchParams.get('position') || '').toUpperCase();
  const metric = (searchParams.get('metric') || 'points') as Metric;
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));

  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const playersResult = await orchestrator.getPlayers(season);

  const filtered = playersResult.data.filter((player: any) => {
    if (team) {
      const teamId = String(player.team?.id || '').toLowerCase();
      const teamAbbr = String(player.team?.abbreviation || '').toLowerCase();
      if (team !== teamId && team !== teamAbbr) return false;
    }
    if (position && String(player.position || '').toUpperCase() !== position) return false;
    return true;
  });

  const projections = filtered
    .slice()
    .sort((a, b) => valueByMetric(b, metric) - valueByMetric(a, metric))
    .slice(0, limit)
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      team: player.team?.abbreviation,
      position: player.position,
      metric,
      metricValue: valueByMetric(player, metric),
      projection: player.projection,
    }));

  return NextResponse.json({
    success: true,
    data: projections,
    source: playersResult.source,
    sourceHealth: playersResult.sourceHealth ?? 'degraded',
    cacheStatus: playersResult.cacheStatus ?? 'rejected',
    warning: playersResult.warning,
    errorCode: playersResult.errorCode,
    filters: { team: team || null, position: position || null, metric, limit },
    total: projections.length,
  });
}
