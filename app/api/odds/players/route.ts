import { NextResponse } from 'next/server';
import { getDataOrchestrator } from '@/lib/data-orchestrator';
import { getMarketSnapshotsByGame } from '@/lib/odds/market-store';
import { americanOddsToImpliedProb, calculateEdge, expectedValuePerUnit, toPercent } from '@/lib/odds/market-utils';
import { calculateOverUnder } from '@/lib/ai/engine';

type Metric = 'points' | 'assists' | 'rebounds';

const MARKET_BY_METRIC: Record<Metric, string> = {
  points: 'player_points',
  assists: 'player_assists',
  rebounds: 'player_rebounds',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('gameId') || '';
  const metric = (searchParams.get('metric') || 'points') as Metric;
  const minEdge = Number(searchParams.get('minEdgePct') || 0);

  if (!gameId) {
    return NextResponse.json({
      success: true,
      data: [],
      source: 'none',
      sourceHealth: 'degraded',
      cacheStatus: 'rejected',
      warning: 'gameId is required',
      errorCode: 'UPSTREAM_BAD_RESPONSE',
      total: 0,
    });
  }

  const marketType = MARKET_BY_METRIC[metric] || MARKET_BY_METRIC.points;
  const snapshots = await getMarketSnapshotsByGame(gameId);
  const relevant = snapshots
    .filter((s) => s.marketType === marketType && Boolean(s.playerId))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const latestByPlayer = new Map<string, any>();
  for (const snap of relevant) {
    const key = String(snap.playerId);
    if (!latestByPlayer.has(key)) latestByPlayer.set(key, snap);
  }

  const season = process.env.NBA_SEASON;
  const orchestrator = getDataOrchestrator();
  const playersResult = await orchestrator.getPlayers(season);
  const playersById = new Map(playersResult.data.map((p: any) => [String(p.id), p]));

  const picks = Array.from(latestByPlayer.values())
    .map((snap) => {
      const player = playersById.get(String(snap.playerId));
      if (!player) return null;

      const line = Number(snap.line);
      if (!Number.isFinite(line)) return null;

      const overUnder = calculateOverUnder(player, metric, line);
      const overModelProb = Number(overUnder.over) / 100;
      const implied = Number.isFinite(Number(snap.impliedProb))
        ? Number(snap.impliedProb)
        : americanOddsToImpliedProb(Number(snap.americanOdds));
      const edge = calculateEdge(overModelProb, implied);
      const ev = expectedValuePerUnit(overModelProb, Number(snap.americanOdds));

      return {
        gameId,
        playerId: player.id,
        playerName: player.name,
        team: player.team?.abbreviation,
        metric,
        marketType,
        line,
        americanOdds: Number.isFinite(Number(snap.americanOdds)) ? Number(snap.americanOdds) : null,
        impliedProb: toPercent(implied),
        modelProb: Number(overUnder.over),
        edge: toPercent(edge),
        expectedValue: Number((ev * 100).toFixed(2)),
        confidence: overUnder.confidence,
        source: snap.source,
        sportsbook: snap.sportsbook,
        lineTimestamp: snap.timestamp,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.edge >= minEdge)
    .sort((a, b) => b.edge - a.edge);

  const warnings: string[] = [];
  if (!relevant.length) warnings.push(`No ${marketType} snapshots found for game ${gameId}`);
  if (playersResult.warning) warnings.push(playersResult.warning);

  return NextResponse.json({
    success: true,
    data: picks,
    source: picks.length > 0 ? 'boltodds' : playersResult.source,
    sourceHealth: picks.length > 0 ? 'ok' : (playersResult.sourceHealth ?? 'degraded'),
    cacheStatus: picks.length > 0 ? 'fresh' : (playersResult.cacheStatus ?? 'rejected'),
    warning: warnings.length ? warnings.join(' | ') : undefined,
    errorCode: picks.length > 0 ? undefined : (playersResult.errorCode || 'UPSTREAM_BAD_RESPONSE'),
    filters: { gameId, metric, minEdgePct: minEdge },
    total: picks.length,
  });
}

