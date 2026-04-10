import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';

function metricAccuracy(players: any[], metric: 'points' | 'assists' | 'rebounds') {
  if (!players.length) return 0;
  const field = metric === 'points' ? 'projectedPoints' : metric === 'assists' ? 'projectedAssists' : 'projectedRebounds';
  const seasonField = metric;

  const errors = players.map((p) => {
    const predicted = Number(p.projection?.[field] || 0);
    const actual = Number(p.seasonStats?.[seasonField] || 0);
    const denom = Math.max(1, actual);
    return Math.abs(predicted - actual) / denom;
  });

  const mape = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  return Math.max(0, Math.min(100, Number((100 - mape * 100).toFixed(2))));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const windowDays = Math.max(1, Number(searchParams.get('windowDays') || 7));

  const orchestrator = getDataOrchestrator();
  const season = process.env.NBA_SEASON;
  const playersResult = await orchestrator.getPlayers(season);
  const players = playersResult.data.filter((p: any) => p.projection && p.seasonStats);

  const points = metricAccuracy(players, 'points');
  const assists = metricAccuracy(players, 'assists');
  const rebounds = metricAccuracy(players, 'rebounds');
  const overall = Number(((points + assists + rebounds) / 3).toFixed(2));

  return NextResponse.json({
    success: true,
    data: {
      overall: {
        correct: Math.round((overall / 100) * players.length),
        total: players.length,
        accuracy: overall,
        lastUpdated: new Date().toISOString(),
      },
      byMetric: {
        points,
        assists,
        rebounds,
      },
      period: {
        windowDays,
        method: 'season-projection-vs-season-average',
      },
    },
    source: playersResult.source,
    sourceHealth: playersResult.sourceHealth ?? 'degraded',
    cacheStatus: playersResult.cacheStatus ?? 'rejected',
    warning: players.length ? playersResult.warning : (playersResult.warning || 'No players available to compute accuracy'),
    errorCode: playersResult.errorCode,
  });
}
